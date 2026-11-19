import { Router } from "express";
import bcrypt from "bcryptjs";
import { isAddress, getAddress, verifyMessage } from "ethers";
import { randomBytes } from "node:crypto";
import { data, id, save } from "../db.js";
import { publicUser, requireAuth, signToken } from "../middleware.js";

const router = Router();

const adminWallets = () =>
  (process.env.ADMIN_WALLETS || "").split(",").map((a) => a.trim().toLowerCase()).filter(Boolean);

const loginMessage = (address, nonce) =>
  `Sign in to EV Charge\n\nWallet: ${address}\nNonce: ${nonce}`;

// ---- username + password -------------------------------------------------

router.post("/register", (req, res) => {
  const username = String(req.body?.username || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  if (!/^[a-z0-9_.-]{3,32}$/.test(username))
    return res.status(400).json({ error: "Username must be 3-32 letters, numbers, . _ -" });
  if (password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });
  if (data().users.some((u) => u.username === username))
    return res.status(409).json({ error: "That username is taken" });

  const user = {
    id: id(), username, passwordHash: bcrypt.hashSync(password, 10),
    walletAddress: null, role: "user", createdAt: new Date().toISOString(),
  };
  data().users.push(user);
  save();
  res.status(201).json({ token: signToken(user), user: publicUser(user) });
});

router.post("/login", (req, res) => {
  const username = String(req.body?.username || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  const user = data().users.find((u) => u.username === username);
  if (!user?.passwordHash || !bcrypt.compareSync(password, user.passwordHash))
    return res.status(401).json({ error: "Wrong username or password" });
  res.json({ token: signToken(user), user: publicUser(user) });
});

// ---- wallet signature (ethers verifyMessage) -----------------------------

router.get("/nonce", (req, res) => {
  const address = String(req.query.address || "");
  if (!isAddress(address)) return res.status(400).json({ error: "Invalid wallet address" });
  const checksum = getAddress(address);
  const nonce = randomBytes(16).toString("hex");
  data().nonces[checksum.toLowerCase()] = { nonce, expires: Date.now() + 5 * 60_000 };
  save();
  res.json({ message: loginMessage(checksum, nonce) });
});

router.post("/wallet", (req, res) => {
  const { address, signature } = req.body || {};
  if (!isAddress(address || "") || !signature) return res.status(400).json({ error: "Address and signature required" });
  const checksum = getAddress(address);
  const key = checksum.toLowerCase();
  const entry = data().nonces[key];
  if (!entry || entry.expires < Date.now()) return res.status(400).json({ error: "Nonce expired, try again" });

  let recovered;
  try {
    recovered = verifyMessage(loginMessage(checksum, entry.nonce), signature);
  } catch {
    return res.status(400).json({ error: "Bad signature" });
  }
  if (recovered.toLowerCase() !== key) return res.status(401).json({ error: "Signature does not match wallet" });

  delete data().nonces[key]; // single use

  let user = data().users.find((u) => u.walletAddress?.toLowerCase() === key);
  if (!user) {
    user = {
      id: id(), username: null, passwordHash: null, walletAddress: checksum,
      role: adminWallets().includes(key) ? "admin" : "user",
      createdAt: new Date().toISOString(),
    };
    data().users.push(user);
  }
  save();
  res.json({ token: signToken(user), user: publicUser(user) });
});

router.get("/me", requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));

export default router;
