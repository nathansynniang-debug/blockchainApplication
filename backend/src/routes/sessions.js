import { Router } from "express";
import { data, id, save } from "../db.js";
import { requireAdmin, requireAuth } from "../middleware.js";

const router = Router();
router.use(requireAuth);

// A session is recorded by the frontend after the on-chain payment is confirmed.
router.get("/", (req, res) =>
  res.json({ sessions: data().sessions.filter((s) => s.userId === req.user.id).reverse() }));

router.post("/", (req, res) => {
  const { vehicleId, stationId, kwh, ratePerKwh, totalCost, auctionId, txHash } = req.body || {};
  const vehicle = data().vehicles.find((v) => v.id === vehicleId && v.userId === req.user.id);
  const station = data().stations.find((s) => s.id === stationId);
  if (!vehicle || !station) return res.status(400).json({ error: "Unknown vehicle or station" });
  if (!txHash) return res.status(400).json({ error: "Transaction hash required" });

  const session = {
    id: id(), userId: req.user.id, vehicleId, stationId,
    vehicleName: vehicle.nickname, stationName: station.name,
    kwh: Number(kwh), ratePerKwh: String(ratePerKwh), totalCost: String(totalCost),
    auctionId: String(auctionId), txHash, createdAt: new Date().toISOString(),
  };
  data().sessions.push(session);
  station.kwhAvailable = Math.max(0, station.kwhAvailable - Number(kwh)); // reserve capacity
  save();
  res.status(201).json({ session });
});

router.get("/all", requireAdmin, (_req, res) => res.json({ sessions: data().sessions.slice().reverse() }));

export default router;
