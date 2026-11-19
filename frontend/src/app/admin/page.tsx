"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { api, type Station, type User } from "@/lib/api";
import { CONTRACTS_DEPLOYED, OWNER_ADDRESS, connectWallet, explainError, getEscrow, shortAddr } from "@/lib/wallet";

const blank = { name: "", location: "", walletAddress: "", kwhAvailable: "100", ratePerKwh: "0.50" };

export default function Admin() {
  const { user, token, ready } = useAuth();
  const router = useRouter();
  const [stations, setStations] = useState<Station[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [registered, setRegistered] = useState<Record<string, boolean | undefined>>({});
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    if (ready && (!user || user.role !== "admin")) router.replace(user ? "/dashboard" : "/");
  }, [ready, user, router]);

  const load = useCallback(async () => {
    if (!token) return;
    const [{ stations }, { users }] = await Promise.all([
      api<{ stations: Station[] }>("/api/stations", { token }),
      api<{ users: User[] }>("/api/users", { token }),
    ]);
    setStations(stations); setUsers(users);
    if (CONTRACTS_DEPLOYED) {
      try {
        const escrow = getEscrow();
        const entries = await Promise.all(stations.map(async (s) => [s.walletAddress.toLowerCase(), (await escrow.isStation(s.walletAddress)) as boolean] as const));
        setRegistered(Object.fromEntries(entries));
      } catch { /* node offline */ }
    }
  }, [token]);

  useEffect(() => { load().catch((e) => setError(e.message)); }, [load]);

  async function save(e: FormEvent) {
    e.preventDefault();
    setError(null); setInfo(null);
    try {
      if (editing) await api(`/api/stations/${editing}`, { method: "PUT", token, body: form });
      else await api("/api/stations", { token, body: form });
      setForm(blank); setEditing(null);
      setInfo(editing ? "Station updated." : "Station added. Register it on-chain so it can win auctions.");
      await load();
    } catch (err) { setError((err as Error).message); }
  }

  async function toggle(s: Station) {
    await api(`/api/stations/${s.id}`, { method: "PUT", token, body: { active: !s.active } });
    load();
  }
  async function remove(s: Station) {
    if (!confirm(`Delete ${s.name}?`)) return;
    await api(`/api/stations/${s.id}`, { method: "DELETE", token });
    load();
  }

  /** Escrow.registerStation is onlyOwner: the connected wallet must be the deployer (Hardhat account #0). */
  async function registerOnChain(s: Station) {
    setError(null); setInfo(null);
    try {
      const { signer } = await connectWallet();
      await (await getEscrow(signer).registerStation(s.walletAddress)).wait();
      setInfo(`${s.name} registered on-chain.`);
      load();
    } catch (err) { setError(explainError(err)); }
  }

  if (!ready || user?.role !== "admin" || !token) return <div className="page muted">Loading…</div>;

  return (
    <div className="page">
      <div className="page-head"><h1 style={{ fontSize: "2.2rem" }}>Stations admin</h1></div>
      {error && <div className="notice" role="alert">{error}</div>}
      {info && <p className="success">{info}</p>}

      <div className="cols">
        <section className="panel">
          <h2>Charging stations</h2>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Station</th><th>Wallet</th><th>kWh</th><th>Rate</th><th>Status</th><th /></tr></thead>
              <tbody>
                {stations.map((s) => {
                  const reg = registered[s.walletAddress.toLowerCase()];
                  return (
                    <tr key={s.id}>
                      <td><b>{s.name}</b><br /><span className="muted small">{s.location}</span></td>
                      <td title={s.walletAddress}>{shortAddr(s.walletAddress)}</td>
                      <td className="num">{s.kwhAvailable}</td>
                      <td className="num">{Number(s.ratePerKwh).toFixed(2)}</td>
                      <td>
                        <span className={`tag ${s.active ? "tag-ok" : ""}`}>{s.active ? "Online" : "Offline"}</span>{" "}
                        <span className={`tag ${reg ? "tag-ok" : reg === false ? "tag-bad" : ""}`}>{reg ? "On-chain" : reg === false ? "Not on-chain" : "Unknown"}</span>
                      </td>
                      <td>
                        <div className="row" style={{ gap: "0.4rem", flexWrap: "nowrap" }}>
                          {reg === false && <button className="btn btn-warn btn-sm" onClick={() => registerOnChain(s)}>Register on-chain</button>}
                          <button className="btn btn-quiet btn-sm" onClick={() => { setEditing(s.id); setForm({ name: s.name, location: s.location, walletAddress: s.walletAddress, kwhAvailable: String(s.kwhAvailable), ratePerKwh: s.ratePerKwh }); }}>Edit</button>
                          <button className="btn btn-quiet btn-sm" onClick={() => toggle(s)}>{s.active ? "Take offline" : "Bring online"}</button>
                          <button className="btn btn-danger btn-sm" onClick={() => remove(s)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="muted small">
            On-chain registration must be sent from the contract owner’s wallet ({shortAddr(OWNER_ADDRESS)}, Hardhat account #0).
          </p>
        </section>

        <section className="panel">
          <h2>{editing ? "Edit station" : "Add a station"}</h2>
          <form className="stack" onSubmit={save}>
            <label>Name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
            <label>Location<input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></label>
            <label>Wallet address
              <input value={form.walletAddress} onChange={(e) => setForm({ ...form, walletAddress: e.target.value })} placeholder="0x…" required pattern="0x[a-fA-F0-9]{40}" />
            </label>
            <div className="grid-2">
              <label>kWh available<input type="number" min="0" value={form.kwhAvailable} onChange={(e) => setForm({ ...form, kwhAvailable: e.target.value })} required /></label>
              <label>Rate (EVC per kWh)<input type="number" min="0.0001" step="0.0001" value={form.ratePerKwh} onChange={(e) => setForm({ ...form, ratePerKwh: e.target.value })} required /></label>
            </div>
            <div className="row">
              <button className="btn btn-primary">{editing ? "Save changes" : "Add station"}</button>
              {editing && <button type="button" className="btn btn-quiet" onClick={() => { setEditing(null); setForm(blank); }}>Cancel</button>}
            </div>
          </form>
        </section>
      </div>

      <section className="panel" style={{ marginTop: "1.5rem" }}>
        <h2>Users</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Username</th><th>Wallet</th><th>Role</th><th>Joined</th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.username ?? "—"}</td>
                  <td>{u.walletAddress ? shortAddr(u.walletAddress) : "—"}</td>
                  <td><span className={`role role-${u.role}`}>{u.role}</span></td>
                  <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
