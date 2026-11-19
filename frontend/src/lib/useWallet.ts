"use client";
import { formatUnits } from "ethers";
import { useCallback, useEffect, useState } from "react";
import { CONTRACTS_DEPLOYED, connectWallet, getToken } from "./wallet";

export type WalletState = ReturnType<typeof useWallet>;

/** Tracks the connected wallet address and its EVC balance. Signing always goes through connectWallet(). */
export function useWallet() {
  const [address, setAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);

  const refreshBalance = useCallback(async (addr?: string | null) => {
    const a = addr ?? address;
    if (!a || !CONTRACTS_DEPLOYED) return;
    try {
      setBalance(formatUnits(await getToken().balanceOf(a), 18));
    } catch {
      setBalance(null); // local node probably isn't running
    }
  }, [address]);

  const connect = useCallback(async () => {
    const { address: a } = await connectWallet();
    setAddress(a);
    await refreshBalance(a);
    return a;
  }, [refreshBalance]);

  // Pick up an already-authorised account without opening a popup.
  useEffect(() => {
    const eth = window.ethereum;
    if (!eth) return;
    eth.request({ method: "eth_accounts" }).then((accts) => {
      const first = (accts as string[])[0];
      if (first) { setAddress(first); refreshBalance(first); }
    }).catch(() => {});
    const onAccounts = (accts: string[]) => { setAddress(accts[0] ?? null); setBalance(null); if (accts[0]) refreshBalance(accts[0]); };
    eth.on?.("accountsChanged", onAccounts);
    return () => eth.removeListener?.("accountsChanged", onAccounts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { address, balance, connect, refreshBalance };
}
