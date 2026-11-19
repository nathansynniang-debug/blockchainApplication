import { Router } from "express";
import { data } from "../db.js";
import { publicUser, requireAdmin, requireAuth } from "../middleware.js";

const router = Router();
router.use(requireAuth, requireAdmin);

router.get("/", (_req, res) => res.json({ users: data().users.map(publicUser) }));

export default router;
