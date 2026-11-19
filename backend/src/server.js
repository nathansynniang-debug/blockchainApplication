import express from "express";
import cors from "cors";
import { init } from "./db.js";
import auth from "./routes/auth.js";
import stations from "./routes/stations.js";
import vehicles from "./routes/vehicles.js";
import sessions from "./routes/sessions.js";
import users from "./routes/users.js";

init();

const app = express();
app.use(cors({ origin: process.env.FRONTEND_ORIGIN || "http://localhost:3000" }));
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api/auth", auth);
app.use("/api/stations", stations);
app.use("/api/vehicles", vehicles);
app.use("/api/sessions", sessions);
app.use("/api/users", users);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong on the server" });
});

const port = Number(process.env.PORT || 4000);
app.listen(port, () => console.log(`EV Charge API listening on http://localhost:${port}`));
