import { Router } from "express";
import { isAddress, getAddress, parseUnits } from "ethers";
import { data, id, save } from "../db.js";
import { requireAdmin, requireAuth } from "../middleware.js";

const router = Router();

function parseStation(body, existing = {}) {
  const s = { ...existing };
  if (body.name !== undefined) s.name = String(body.name).trim();
  if (body.location !== undefined) s.location = String(body.location).trim();
  if (body.walletAddress !== undefined) {
    if (!isAddress(body.walletAddress)) throw new Error("Invalid wallet address");
    s.walletAddress = getAddress(body.walletAddress);
  }
  if (body.kwhAvailable !== undefined) {
    const k = Number(body.kwhAvailable);
    if (!Number.isFinite(k) || k < 0) throw new Error("kWh available must be 0 or more");
    s.kwhAvailable = Math.floor(k);
  }
  if (body.ratePerKwh !== undefined) {
    const r = String(body.ratePerKwh);
    try { if (parseUnits(r, 18) <= 0n) throw 0; } catch { throw new Error("Rate must be a positive number"); }
    s.ratePerKwh = r;
  }
  if (body.active !== undefined) s.active = Boolean(body.active);
  if (!s.name || !s.walletAddress || s.ratePerKwh === undefined) throw new Error("Name, wallet address and rate are required");
  return s;
}

router.use(requireAuth);

router.get("/", (_req, res) => res.json({ stations: data().stations }));

router.post("/", requireAdmin, (req, res) => {
  try {
    const station = { id: id(), active: true, location: "", kwhAvailable: 0, ...parseStation(req.body) };
    if (data().stations.some((s) => s.walletAddress === station.walletAddress))
      return res.status(409).json({ error: "A station with that wallet already exists" });
    data().stations.push(station);
    save();
    res.status(201).json({ station });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.put("/:id", requireAdmin, (req, res) => {
  const idx = data().stations.findIndex((s) => s.id === req.params.id);
  if (idx < 0) return res.status(404).json({ error: "Station not found" });
  try {
    data().stations[idx] = parseStation(req.body, data().stations[idx]);
    save();
    res.json({ station: data().stations[idx] });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.delete("/:id", requireAdmin, (req, res) => {
  const before = data().stations.length;
  data().stations = data().stations.filter((s) => s.id !== req.params.id);
  if (data().stations.length === before) return res.status(404).json({ error: "Station not found" });
  save();
  res.status(204).end();
});

export default router;
