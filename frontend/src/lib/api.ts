export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export type Role = "admin" | "user";
export type User = { id: string; username: string | null; walletAddress: string | null; role: Role; createdAt: string };
export type Station = {
  id: string; name: string; location: string; walletAddress: string;
  kwhAvailable: number; ratePerKwh: string; active: boolean;
};
export type Vehicle = {
  id: string; nickname: string; make: string; model: string; plate: string; batteryKwh: number; connector: string;
};
export type Session = {
  id: string; vehicleName: string; stationName: string; kwh: number; ratePerKwh: string;
  totalCost: string; auctionId: string; txHash: string; createdAt: string;
};

export async function api<T = unknown>(
  path: string,
  opts: { method?: string; body?: unknown; token?: string | null } = {},
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: opts.method ?? (opts.body ? "POST" : "GET"),
      headers: {
        ...(opts.body ? { "Content-Type": "application/json" } : {}),
        ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new Error(`Can't reach the API at ${API_URL}. Is the backend running?`);
  }
  if (res.status === 204) return undefined as T;
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`);
  return json as T;
}
