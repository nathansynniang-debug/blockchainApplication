"use client";
import type { Station } from "@/lib/api";
import { shortAddr } from "@/lib/wallet";

export type Eligibility = { ok: boolean; reason?: string };

/** Which stations can take part in an auction for `kwh`, and why not if they can't. */
export function eligibility(s: Station, registered: Record<string, boolean | undefined>, kwh: number): Eligibility {
  if (!s.active) return { ok: false, reason: "Offline" };
  if (registered[s.walletAddress.toLowerCase()] === false) return { ok: false, reason: "Not registered on-chain" };
  if (s.kwhAvailable < kwh) return { ok: false, reason: `Only ${s.kwhAvailable} kWh free` };
  return { ok: true };
}

export default function PriceBoard({
  stations, registered, kwh, wonStationId, intro,
}: {
  stations: Station[];
  registered: Record<string, boolean | undefined>;
  kwh: number;
  wonStationId?: string;
  intro?: boolean;
}) {
  const rows = stations.map((s) => ({ s, el: eligibility(s, registered, kwh) }));
  const lowest = rows.filter((r) => r.el.ok).sort((a, b) => Number(a.s.ratePerKwh) - Number(b.s.ratePerKwh))[0]?.s.id;

  return (
    <div className={`board ${intro ? "intro" : ""}`}>
      <div className="board-title">
        <span>Charging stations</span>
        <span>Price per kWh (EVC)</span>
      </div>
      {rows.length === 0 && <div className="bid"><span className="bid-meta">No stations yet.</span></div>}
      {rows.map(({ s, el }) => (
        <div key={s.id} className={`bid ${el.ok && s.id === lowest ? "lowest" : ""} ${el.ok ? "" : "out"} ${s.id === wonStationId ? "won" : ""}`}>
          <span className="bid-name">{s.name}</span>
          <span className="bid-rate">{Number(s.ratePerKwh).toFixed(2)}<small>EVC</small></span>
          <span className="bid-meta">
            {s.location} · {s.kwhAvailable} kWh available · {shortAddr(s.walletAddress)}
            {!el.ok && ` · ${el.reason}`}
          </span>
        </div>
      ))}
    </div>
  );
}
