"use client";
import { formatUnits, parseUnits } from "ethers";
import { useState } from "react";
import { api, type Station, type Vehicle } from "@/lib/api";
import {
  CONTRACTS_DEPLOYED, ESCROW_ADDRESS, connectWallet, explainError, getEscrow, getToken, shortAddr,
} from "@/lib/wallet";
import type { WalletState } from "@/lib/useWallet";
import { eligibility } from "./PriceBoard";

type Won = { auctionId: bigint; station: Station; rate: bigint; kwh: bigint; total: bigint; vehicleId: string };
type Phase = "idle" | "auction" | "approve" | "pay";

export default function AuctionPanel({
  stations, vehicles, registered, kwh, setKwh, wallet, token, onPaid, onWinner,
}: {
  stations: Station[];
  vehicles: Vehicle[];
  registered: Record<string, boolean | undefined>;
  kwh: number;
  setKwh: (n: number) => void;
  wallet: WalletState;
  token: string;
  onPaid: () => void;
  onWinner: (stationId?: string) => void;
}) {
  const [vehicleId, setVehicleId] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [won, setWon] = useState<Won | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paidTx, setPaidTx] = useState<string | null>(null);

  const vehicle = vehicles.find((v) => v.id === (vehicleId || vehicles[0]?.id));
  const entrants = stations.filter((s) => eligibility(s, registered, kwh).ok);
  const busy = phase !== "idle";
  const canStart = CONTRACTS_DEPLOYED && !!vehicle && kwh > 0 && entrants.length > 0 && !busy && !won;

  /** Calls Escrow.reverseAuction(address[] stations, uint256[] rates, uint256 kWh) from the user's wallet. */
  async function startAuction() {
    if (!vehicle) return;
    setError(null); setPaidTx(null); setPhase("auction");
    try {
      const { signer } = await connectWallet();
      const escrow = getEscrow(signer);
      const addresses = entrants.map((s) => s.walletAddress);
      const rates = entrants.map((s) => parseUnits(s.ratePerKwh, 18)); // price per kWh in token base units

      const tx = await escrow.reverseAuction(addresses, rates, BigInt(kwh));
      const receipt = await tx.wait();

      const log = receipt!.logs
        .map((l: any) => { try { return escrow.interface.parseLog(l); } catch { return null; } })
        .find((p: any) => p?.name === "AuctionWon");
      if (!log) throw new Error("The auction transaction succeeded but no winner event was found.");

      const winnerAddr: string = log.args.station;
      const station = stations.find((s) => s.walletAddress.toLowerCase() === winnerAddr.toLowerCase());
      if (!station) throw new Error("The winning wallet isn't in the station list.");
      setWon({ auctionId: log.args.auctionId, station, rate: log.args.ratePerKwh, kwh: log.args.kwh, total: log.args.totalCost, vehicleId: vehicle.id });
      onWinner(station.id);
    } catch (e) { setError(explainError(e)); }
    finally { setPhase("idle"); }
  }

  /** Approves the escrow to pull the fee, then Escrow.payAuction() sends it on to the winning station. */
  async function pay() {
    if (!won) return;
    setError(null);
    let txHash: string;
    let payer: string;
    try {
      const { signer, address } = await connectWallet();
      payer = address;
      const erc20 = getToken(signer);
      const allowance: bigint = await erc20.allowance(address, ESCROW_ADDRESS);
      if (allowance < won.total) {
        setPhase("approve");
        const approval = await erc20.approve(ESCROW_ADDRESS, won.total);
        const approvalReceipt = await approval.wait();
        if (!approvalReceipt || approvalReceipt.status !== 1) {
          throw new Error("Token approval was not confirmed. No payment was submitted.");
        }
      }

      setPhase("pay");
      const tx = await getEscrow(signer).payAuction(won.auctionId);
      const receipt = await tx.wait();
      if (!receipt || receipt.status !== 1) throw new Error("The payment transaction was not confirmed.");
      txHash = tx.hash;
    } catch (e) {
      setError(explainError(e));
      return;
    } finally {
      setPhase("idle");
    }

    // The chain is authoritative: do not report the payment as failed because a
    // subsequent API call or balance refresh fails. Clear the paid auction as
    // soon as its transaction has been mined successfully.
    setPaidTx(txHash);
    setWon(null);
    onWinner(undefined);
    onPaid();

    try {
      await api("/api/sessions", {
        token,
        body: {
          vehicleId: won.vehicleId, stationId: won.station.id, kwh: Number(won.kwh),
          ratePerKwh: formatUnits(won.rate, 18), totalCost: formatUnits(won.total, 18),
          auctionId: won.auctionId.toString(), txHash,
        },
      });
    } catch (e) {
      setError(`Payment confirmed on-chain (${shortAddr(txHash)}), but the charging session could not be saved: ${explainError(e)}`);
    }

    try {
      await wallet.refreshBalance(payer);
    } catch {
      // A balance refresh failure must not make a mined payment look unsuccessful.
    }
  }

  async function cancel() {
    if (!won) return;
    try {
      const { signer } = await connectWallet();
      await (await getEscrow(signer).cancelAuction(won.auctionId)).wait();
    } catch (e) { setError(explainError(e)); return; }
    setWon(null); onWinner(undefined);
  }

  return (
    <section className="panel">
      <h2>Start a reverse auction</h2>
      <p className="muted small" style={{ marginTop: "-0.5rem" }}>
        Every available station bids its price per kWh. The cheapest one wins your session.
      </p>

      <div className="stack">
        <label>Vehicle
          <select value={vehicle?.id ?? ""} onChange={(e) => setVehicleId(e.target.value)} disabled={vehicles.length === 0 || !!won}>
            {vehicles.length === 0 && <option value="">Register a vehicle first</option>}
            {vehicles.map((v) => <option key={v.id} value={v.id}>{v.nickname} ({v.plate})</option>)}
          </select>
        </label>
        <label>kWh you want
          <input type="number" min={1} max={vehicle?.batteryKwh ?? 200} value={kwh} disabled={!!won}
            onChange={(e) => setKwh(Math.max(0, Math.floor(Number(e.target.value))))} />
        </label>

        {!CONTRACTS_DEPLOYED && <p className="error">Contracts aren’t deployed yet. Run <code>npm run deploy:local</code> in /hardhat.</p>}
        {CONTRACTS_DEPLOYED && entrants.length === 0 && <p className="muted small">No station can supply {kwh} kWh right now.</p>}

        <button className="btn btn-primary btn-big" disabled={!canStart} onClick={startAuction}>
          {phase === "auction" ? "Confirm in your wallet…" : `Start reverse auction (${entrants.length} bidders)`}
        </button>
      </div>

      {won && (
        <div className="result">
          <div>
            <span className="muted small">Winning bid</span>
            <div className="big">{formatUnits(won.rate, 18)} EVC<span className="small muted"> /kWh</span></div>
          </div>
          <div className="kv"><span>Station</span><b>{won.station.name}</b></div>
          <div className="kv"><span>Pays to</span><span>{shortAddr(won.station.walletAddress)}</span></div>
          <div className="kv"><span>Energy</span><span className="num">{won.kwh.toString()} kWh</span></div>
          <div className="kv"><span>Total to pay</span><b className="num">{formatUnits(won.total, 18)} EVC</b></div>
          <button className="btn btn-warn btn-big" disabled={busy} onClick={pay}>
            {phase === "approve" ? "Approve spending in wallet…" : phase === "pay" ? "Confirm payment in wallet…" : `Pay ${formatUnits(won.total, 18)} EVC`}
          </button>
          <button className="btn btn-quiet btn-sm" disabled={busy} onClick={cancel}>Cancel this auction</button>
          <p className="muted small" style={{ margin: 0 }}>You have 15 minutes to pay before this auction expires.</p>
        </div>
      )}

      {paidTx && <p className="success">Payment confirmed on-chain. (tx {shortAddr(paidTx)})</p>}
      {error && <p className="error" role="alert">{error}</p>}
    </section>
  );
}
