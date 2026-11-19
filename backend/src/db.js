// Tiny JSON-file datastore (no native deps). Swap for Postgres/Mongo in production.
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";

const DIR = path.resolve("data");
const FILE = path.join(DIR, "db.json");

let db = { users: [], stations: [], vehicles: [], sessions: [], nonces: {} };

export function save() {
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(db, null, 2));
}

export const id = () => randomUUID();
export const data = () => db;

// Hardhat's public dev accounts #1-#5 act as mock charging stations.
const SEED_STATIONS = [
  { name: "Mahanadi Fast Hub",    location: "Sambalpur, Odisha",     walletAddress: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", kwhAvailable: 120, ratePerKwh: "0.50" },
  { name: "Hirakud Dam Charge",   location: "Hirakud, Odisha",       walletAddress: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", kwhAvailable: 80,  ratePerKwh: "0.42" },
  { name: "Burla Campus Station", location: "Burla, Odisha",         walletAddress: "0x90F79bf6EB2c4f870365E785982E1f101E93b906", kwhAvailable: 60,  ratePerKwh: "0.35" },
  { name: "NH-53 Highway Plaza",  location: "Jharsuguda Road",       walletAddress: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65", kwhAvailable: 200, ratePerKwh: "0.61" },
  { name: "Ainthapali Quick Bay", location: "Ainthapali, Sambalpur", walletAddress: "0x9965507D1a55bcC2695C58ba16FB37819cC00D20", kwhAvailable: 45,  ratePerKwh: "0.38" },
];

export function init() {
  if (fs.existsSync(FILE)) db = { ...db, ...JSON.parse(fs.readFileSync(FILE, "utf8")) };

  const adminName = (process.env.ADMIN_USERNAME || "admin").toLowerCase();
  if (!db.users.some((u) => u.username === adminName)) {
    db.users.push({
      id: id(),
      username: adminName,
      passwordHash: bcrypt.hashSync(process.env.ADMIN_PASSWORD || "admin123", 10),
      walletAddress: null,
      role: "admin",
      createdAt: new Date().toISOString(),
    });
  }
  if (db.stations.length === 0) {
    for (const s of SEED_STATIONS) db.stations.push({ id: id(), active: true, ...s });
  }
  save();
}
