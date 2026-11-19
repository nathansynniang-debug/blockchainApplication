"use client";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { shortAddr } from "@/lib/wallet";

export default function Navbar() {
  const { user, ready, openSignIn, signOut } = useAuth();
  return (
    <header className="nav">
      <Link href="/" className="brand">ChargeBid</Link>
      <nav>
        {ready && user ? (
          <>
            <Link href="/dashboard">Dashboard</Link>
            {user.role === "admin" && <Link href="/admin">Stations admin</Link>}
            <span className="who" title={user.walletAddress ?? undefined}>
              {user.username ?? shortAddr(user.walletAddress)}
              <em className={`role role-${user.role}`}>{user.role}</em>
            </span>
            <button className="btn btn-quiet" onClick={signOut}>Sign out</button>
          </>
        ) : (
          <button className="btn btn-primary" onClick={openSignIn}>Sign in</button>
        )}
      </nav>
    </header>
  );
}
