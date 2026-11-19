"use client";
import { useState, type FormEvent } from "react";
import { api, type Vehicle } from "@/lib/api";

export default function VehiclesPanel({
  vehicles, token, onChange,
}: { vehicles: Vehicle[]; token: string; onChange: () => void }) {
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = Object.fromEntries(new FormData(form));
    setError(null);
    try {
      await api("/api/vehicles", { token, body: f });
      form.reset();
      setAdding(false);
      onChange();
    } catch (err) { setError((err as Error).message); }
  }

  async function remove(id: string) {
    await api(`/api/vehicles/${id}`, { method: "DELETE", token });
    onChange();
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>My vehicles</h2>
        {!adding && <button className="btn btn-quiet btn-sm" onClick={() => setAdding(true)}>Register an EV</button>}
      </div>

      {adding && (
        <form onSubmit={add} className="stack" style={{ marginBottom: "1rem" }}>
          <div className="grid-2">
            <label>Make<input name="make" placeholder="Tata" required /></label>
            <label>Model<input name="model" placeholder="Nexon EV" required /></label>
          </div>
          <div className="grid-2">
            <label>Number plate<input name="plate" placeholder="OD 15 AB 1234" required /></label>
            <label>Battery (kWh)<input name="batteryKwh" type="number" min="1" step="0.1" placeholder="40.5" required /></label>
          </div>
          <div className="grid-2">
            <label>Nickname (optional)<input name="nickname" /></label>
            <label>Connector
              <select name="connector" defaultValue="CCS2">
                <option>CCS2</option><option>Type 2</option><option>CHAdeMO</option><option>GB/T</option>
              </select>
            </label>
          </div>
          <div className="row">
            <button className="btn btn-primary">Save vehicle</button>
            <button type="button" className="btn btn-quiet" onClick={() => setAdding(false)}>Cancel</button>
          </div>
          {error && <p className="error" role="alert">{error}</p>}
        </form>
      )}

      {vehicles.length === 0 && !adding ? (
        <p className="muted">Register your EV to start an auction for it.</p>
      ) : (
        <ul className="list">
          {vehicles.map((v) => (
            <li className="item" key={v.id}>
              <div>
                <b>{v.nickname}</b>
                <span className="muted small">{v.plate} · {v.batteryKwh} kWh · {v.connector}</span>
              </div>
              <button className="btn btn-danger btn-sm" onClick={() => remove(v.id)}>Remove</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
