"use client";
import type { Session } from "@/lib/api";
import { shortAddr } from "@/lib/wallet";

export default function SessionsPanel({ sessions }: { sessions: Session[] }) {
  return (
    <section className="panel">
      <h2>Charging history</h2>
      {sessions.length === 0 ? (
        <p className="muted">Paid sessions will show up here.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Date</th><th>Vehicle</th><th>Station</th><th>kWh</th><th>Paid</th><th>Tx</th></tr></thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id}>
                  <td>{new Date(s.createdAt).toLocaleString()}</td>
                  <td>{s.vehicleName}</td>
                  <td>{s.stationName}</td>
                  <td className="num">{s.kwh}</td>
                  <td className="num">{Number(s.totalCost).toFixed(2)} EVC</td>
                  <td title={s.txHash}>{shortAddr(s.txHash)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
