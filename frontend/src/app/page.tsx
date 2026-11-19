"use client";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import PriceBoard from "@/components/PriceBoard";
import type { Station } from "@/lib/api";

// Illustrative bids shown before sign-in. Real rates come from the backend after signing in.
const sample: Station[] = [
  { id: "a", name: "Hirakud Dam Charge", location: "Hirakud", walletAddress: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", kwhAvailable: 80, ratePerKwh: "0.42", active: true },
  { id: "b", name: "Burla Campus Station", location: "Burla", walletAddress: "0x90F79bf6EB2c4f870365E785982E1f101E93b906", kwhAvailable: 60, ratePerKwh: "0.35", active: true },
  { id: "c", name: "NH-53 Highway Plaza", location: "Jharsuguda Road", walletAddress: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65", kwhAvailable: 200, ratePerKwh: "0.61", active: true },
  { id: "d", name: "Ainthapali Quick Bay", location: "Ainthapali", walletAddress: "0x9965507D1a55bcC2695C58ba16FB37819cC00D20", kwhAvailable: 45, ratePerKwh: "0.38", active: true },
];

export default function Home() {
  const { user, ready, openSignIn } = useAuth();
  return (
    <>
      <section className="hero">
        <div>
          <h1>Stations bid. You pay the lowest rate.</h1>
          <p className="lead">
            Register your EV, tell us how much energy you need, and every nearby charging station competes for your session.
            The smart contract picks the cheapest price per kWh and pays the station straight from your wallet.
          </p>
          {ready && user ? (
            <Link href="/dashboard" className="btn btn-primary btn-big" style={{ textDecoration: "none", display: "inline-block" }}>Open dashboard</Link>
          ) : (
            <button className="btn btn-primary btn-big" onClick={openSignIn}>Sign in</button>
          )}
        </div>
        <div>
          <PriceBoard stations={sample} registered={{}} kwh={20} intro />
          <p className="muted small" style={{ marginTop: "0.6rem" }}>Example bids for a 20 kWh session.</p>
        </div>
      </section>

      <ol className="steps">
        <li><h3>Connect your wallet</h3><p>Sign in with MetaMask. No gas, no funds moved.</p></li>
        <li><h3>Register your EV</h3><p>Save your vehicle’s plate, battery size and connector once.</p></li>
        <li><h3>Start the auction</h3><p>Your wallet sends each station’s rate to the Escrow contract and the lowest bid wins.</p></li>
        <li><h3>Pay and charge</h3><p>Pay the winning price. The escrow forwards it to that station’s wallet.</p></li>
      </ol>
    </>
  );
}
