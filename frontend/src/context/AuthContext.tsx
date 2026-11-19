"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { api, type User } from "@/lib/api";
import { connectWallet } from "@/lib/wallet";
import SignInModal from "@/components/SignInModal";

type AuthResponse = { token: string; user: User };

type Auth = {
  user: User | null;
  token: string | null;
  ready: boolean;
  signInWithWallet: () => Promise<void>;
  signInWithPassword: (username: string, password: string) => Promise<void>;
  registerWithPassword: (username: string, password: string) => Promise<void>;
  signOut: () => void;
  openSignIn: () => void;
};

const Ctx = createContext<Auth | null>(null);
const KEY = "evc_token";

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  // Restore the session on page load.
  useEffect(() => {
    const saved = localStorage.getItem(KEY);
    if (!saved) { setReady(true); return; }
    api<{ user: User }>("/api/auth/me", { token: saved })
      .then(({ user }) => { setToken(saved); setUser(user); })
      .catch(() => localStorage.removeItem(KEY))
      .finally(() => setReady(true));
  }, []);

  const finish = useCallback((res: AuthResponse) => {
    localStorage.setItem(KEY, res.token);
    setToken(res.token);
    setUser(res.user);
    setModalOpen(false);
    router.push("/dashboard");
  }, [router]);

  const signInWithWallet = useCallback(async () => {
    const { signer, address } = await connectWallet(); // wallet popup
    const { message } = await api<{ message: string }>(`/api/auth/nonce?address=${address}`);
    const signature = await signer.signMessage(message); // proves ownership, no gas
    finish(await api<AuthResponse>("/api/auth/wallet", { body: { address, signature } }));
  }, [finish]);

  const signInWithPassword = useCallback(async (username: string, password: string) => {
    finish(await api<AuthResponse>("/api/auth/login", { body: { username, password } }));
  }, [finish]);

  const registerWithPassword = useCallback(async (username: string, password: string) => {
    finish(await api<AuthResponse>("/api/auth/register", { body: { username, password } }));
  }, [finish]);

  const signOut = useCallback(() => {
    localStorage.removeItem(KEY);
    setToken(null);
    setUser(null);
    router.push("/");
  }, [router]);

  const value = useMemo<Auth>(() => ({
    user, token, ready, signInWithWallet, signInWithPassword, registerWithPassword, signOut,
    openSignIn: () => setModalOpen(true),
  }), [user, token, ready, signInWithWallet, signInWithPassword, registerWithPassword, signOut]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {modalOpen && <SignInModal onClose={() => setModalOpen(false)} />}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside <AuthProvider>");
  return v;
}
