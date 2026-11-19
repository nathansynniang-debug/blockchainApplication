import jwt from "jsonwebtoken";
import { data } from "./db.js";

const secret = () => process.env.JWT_SECRET || "dev-secret-change-me";

export const signToken = (user) =>
  jwt.sign({ sub: user.id, role: user.role }, secret(), { expiresIn: "12h" });

export const publicUser = (u) => ({
  id: u.id,
  username: u.username ?? null,
  walletAddress: u.walletAddress ?? null,
  role: u.role,
  createdAt: u.createdAt,
});

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing token" });
  try {
    const payload = jwt.verify(token, secret());
    const user = data().users.find((u) => u.id === payload.sub);
    if (!user) return res.status(401).json({ error: "Unknown user" });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") return res.status(403).json({ error: "Admins only" });
  next();
}
