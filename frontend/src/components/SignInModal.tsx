"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useAuth } from "@/context/AuthContext";
import { explainError } from "@/lib/wallet";

export default function SignInModal({ onClose }: { onClose: () => void }) {
  const { signInWithWallet, signInWithPassword, registerWithPassword } = useAuth();
  const [view, setView] = useState<"wallet" | "password">("wallet");
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const firstFocus = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    firstFocus.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function run(fn: () => Promise<void>) {
    setBusy(true); setError(null);
    try { await fn(); } catch (e) { setError(explainError(e)); } finally { setBusy(false); }
  }

  function submitPassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const u = String(f.get("username")), p = String(f.get("password"));
    run(() => (creating ? registerWithPassword(u, p) : signInWithPassword(u, p)));
  }

  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="signin-title">
        <button className="modal-x" onClick={onClose} aria-label="Close">×</button>
        <h2 id="signin-title">Sign in to ChargeBid</h2>

        {view === "wallet" ? (
          <>
            <p className="muted">Connect your wallet and sign a short message. It costs no gas and doesn’t move any funds.</p>
            <button ref={firstFocus} className="btn btn-primary btn-block" disabled={busy} onClick={() => run(signInWithWallet)}>
              {busy ? "Waiting for your wallet…" : "Connect wallet"}
            </button>
            <div className="or"><span>or</span></div>
            <button className="btn btn-quiet btn-block" onClick={() => { setView("password"); setError(null); }}>
              Use a username and password
            </button>
          </>
        ) : (
          <>
            <div className="tabs" role="tablist">
              <button role="tab" aria-selected={!creating} className={!creating ? "on" : ""} onClick={() => setCreating(false)}>Sign in</button>
              <button role="tab" aria-selected={creating} className={creating ? "on" : ""} onClick={() => setCreating(true)}>Create account</button>
            </div>
            <form onSubmit={submitPassword} className="stack">
              <label>Username<input name="username" autoComplete="username" required minLength={3} /></label>
              <label>Password
                <input name="password" type="password" autoComplete={creating ? "new-password" : "current-password"} required minLength={creating ? 8 : 1} />
              </label>
              <button ref={firstFocus} className="btn btn-primary btn-block" disabled={busy}>
                {busy ? "Please wait…" : creating ? "Create account" : "Sign in"}
              </button>
            </form>
            <p className="muted small">Administrators sign in here to manage charging stations.</p>
            <button className="btn btn-quiet btn-block" onClick={() => { setView("wallet"); setError(null); }}>Back to wallet sign-in</button>
          </>
        )}

        {error && <p className="error" role="alert">{error}</p>}
      </div>
    </div>
  );
}
