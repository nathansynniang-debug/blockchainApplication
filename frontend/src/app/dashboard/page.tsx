"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { api, type Session, type Station, type Vehicle } from "@/lib/api";
import { CONTRACTS_DEPLOYED, connectWallet, explainError, getEscrow, getToken, shortAddr } from "@/lib/wallet";
import { useWallet } from "@/lib/useWallet";
import PriceBoard from "@/components/PriceBoard";
import AuctionPanel from "@/components/AuctionPanel";
import VehiclesPanel from "@/components/VehiclesPanel";
import SessionsPanel from "@/components/SessionsPanel";

export default function Dashboard() {
  const { user, token, ready } = useAuth();
  const router = useRouter();
  const wallet = useWallet();

  const [stations, setStations] = useState<Station[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [registered, setRegistered] = useState<Record<string, boolean | undefined>>({});
  const [kwh, setKwh] = useState(20);
  const [wonStationId, setWonStationId] = useState<string>();
  const [error, setError] = useState<string | null>(null);
  const [faucetMsg, setFaucetMsg] = useState<string | null>(null);

  useEffect(() => { if (ready && !user) router.replace("/"); }, [ready, user, router]);

  const loadStations = useCallback(async () => {
    if (!token) return;
    const { stations } = await api<{ stations: Station[] }>("/api/stations", { token });
    setStations(stations);
    if (CONTRACTS_DEPLOYED) {
      try {
        const escrow = getEscrow();
        const entries = await Promise.all(stations.map(async (s) => [s.walletAddress.toLowerCase(), (await escrow.isStation(s.walletAddress)) as boolean] as const));
        setRegistered(Object.fromEntries(entries));
      } catch { setRegistered({}); } // local node not reachable; the contract will still enforce it
    }
  }, [token]);
  const loadVehicles = useCallback(async () => {
    if (token) setVehicles((await api<{ vehicles: Vehicle[] }>("/api/vehicles", { token })).vehicles);
  }, [token]);
  const loadSessions = useCallback(async () => {
    if (token) setSessions((await api<{ sessions: Session[] }>("/api/sessions", { token })).sessions);
  }, [token]);

  useEffect(() => {
    Promise.all([loadStations(), loadVehicles(), loadSessions()]).catch((e) => setError(e.message));
  }, [loadStations, loadVehicles, loadSessions]);

  async function faucet() {
    setFaucetMsg(null);
    try {
      const { signer, address } = await connectWallet();
      await (await getToken(signer).faucet()).wait();
      await wallet.refreshBalance(address);
      setFaucetMsg("1,000 EVC added.");
    } catch (e) { setFaucetMsg(explainError(e)); }
  }

  if (!ready || !user || !token) return <div className="page muted">Loading…</div>;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 style={{ fontSize: "2.2rem" }}>Dashboard</h1>
          <p className="muted" style={{ margin: "0.3rem 0 0" }}>
            Signed in as {user.username ?? shortAddr(user.walletAddress)}
          </p>
        </div>
        <div className="row">
          <span className="wallet-chip">
            <span className={`dot ${wallet.address ? "" : "dot-off"}`} />
            {wallet.address ? <>{shortAddr(wallet.address)} · <b className="num">{wallet.balance ? Number(wallet.balance).toFixed(2) : "—"} EVC</b></> : "Wallet not connected"}
          </span>
          {wallet.address ? (
            <button className="btn btn-quiet btn-sm" onClick={faucet}>Get 1,000 EVC</button>
          ) : (
            <button className="btn btn-primary btn-sm" onClick={() => wallet.connect().catch((e) => setError(explainError(e)))}>Connect wallet</button>
          )}
        </div>
      </div>
      {faucetMsg && <p className="muted small">{faucetMsg}</p>}
      {error && <div className="notice" role="alert">{error}</div>}

      <div className="cols">
        <div>
          <PriceBoard stations={stations} registered={registered} kwh={kwh} wonStationId={wonStationId} />
        </div>
        <AuctionPanel
          stations={stations} vehicles={vehicles} registered={registered}
          kwh={kwh} setKwh={setKwh} wallet={wallet} token={token}
          onWinner={setWonStationId}
          onPaid={() => { loadSessions(); loadStations(); }}
        />
      </div>

      <div className="cols-even">
        <VehiclesPanel vehicles={vehicles} token={token} onChange={loadVehicles} />
        <SessionsPanel sessions={sessions} />
      </div>
    </div>
  );
}
