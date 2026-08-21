"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    const data = (await response.json()) as { error?: string };

    setLoading(false);

    if (!response.ok) {
      setError(data.error ?? "Login failed.");
      return;
    }

    router.push("/admin/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="glass mx-auto w-full max-w-md rounded-xl p-6">
      <div className="grid size-12 place-items-center rounded-full border border-[rgba(246,217,143,0.35)] bg-[rgba(246,217,143,0.10)]">
        <Lock className="size-5 text-[#f6d98f]" />
      </div>
      <h1 className="mt-5 font-[var(--font-display)] text-3xl font-black text-white">Admin Login</h1>
      <p className="mt-2 text-sm text-[#aeb7ca]">Private management access for RandomSpin.</p>
      <label className="mt-6 block">
        <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-[#aeb7ca]">Email</span>
        <input
          className="focus-ring h-12 w-full rounded-lg border border-white/10 bg-white/[0.06] px-4 text-white"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          required
        />
      </label>
      <label className="mt-4 block">
        <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-[#aeb7ca]">Password</span>
        <input
          className="focus-ring h-12 w-full rounded-lg border border-white/10 bg-white/[0.06] px-4 text-white"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          required
        />
      </label>
      {error ? <p className="danger-banner mt-4 rounded-lg px-4 py-3 text-sm font-semibold">{error}</p> : null}
      <button className="gold-button focus-ring mt-6 w-full rounded-lg px-5 py-3 text-sm uppercase tracking-[0.18em]" disabled={loading}>
        {loading ? "Signing In" : "Sign In"}
      </button>
    </form>
  );
}
