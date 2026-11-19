import fs from "node:fs";
import path from "node:path";
import { network } from "hardhat";

const { ethers } = await network.create();

// Account #0 deploys and owns the Escrow (the on-chain admin).
// Accounts #1-#5 are the mock charging stations (they match the backend seed data).
const signers = await ethers.getSigners();
const deployer = signers[0];
const stationSigners = signers.slice(1, 6);

const token = await ethers.deployContract("EVCToken");
await token.waitForDeployment();
const escrow = await ethers.deployContract("Escrow", [await token.getAddress()]);
await escrow.waitForDeployment();

for (const s of stationSigners) {
  await (await escrow.registerStation(s.address)).wait();
}

const net = await ethers.provider.getNetwork();
const deployment = {
  chainId: Number(net.chainId),
  token: await token.getAddress(),
  escrow: await escrow.getAddress(),
  owner: deployer.address,
  stations: stationSigners.map((s) => s.address),
};

const out = path.resolve("..", "frontend", "src", "contracts", "deployment.json");
fs.writeFileSync(out, JSON.stringify(deployment, null, 2));

console.log("EVCToken :", deployment.token);
console.log("Escrow   :", deployment.escrow);
console.log("Stations registered:", deployment.stations.length);
console.log("Wrote", out);
