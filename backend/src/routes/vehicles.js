import { Router } from "express";
import { data, id, save } from "../db.js";
import { requireAuth } from "../middleware.js";

const router = Router();
router.use(requireAuth);

router.get("/", (req, res) =>
  res.json({ vehicles: data().vehicles.filter((v) => v.userId === req.user.id) }));

router.post("/", (req, res) => {
  const { nickname, make, model, plate, batteryKwh, connector } = req.body || {};
  const battery = Number(batteryKwh);
  if (!make || !model || !plate) return res.status(400).json({ error: "Make, model and plate are required" });
  if (!Number.isFinite(battery) || battery <= 0) return res.status(400).json({ error: "Battery size must be a positive number" });
  const vehicle = {
    id: id(), userId: req.user.id,
    nickname: String(nickname || `${make} ${model}`).trim(),
    make: String(make).trim(), model: String(model).trim(),
    plate: String(plate).trim().toUpperCase(),
    batteryKwh: battery, connector: String(connector || "CCS2"),
    createdAt: new Date().toISOString(),
  };
  data().vehicles.push(vehicle);
  save();
  res.status(201).json({ vehicle });
});

router.delete("/:id", (req, res) => {
  const before = data().vehicles.length;
  data().vehicles = data().vehicles.filter((v) => !(v.id === req.params.id && v.userId === req.user.id));
  if (data().vehicles.length === before) return res.status(404).json({ error: "Vehicle not found" });
  save();
  res.status(204).end();
});

export default router;
