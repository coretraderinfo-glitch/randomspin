"use client";

import { useState } from "react";
import { SuccessBanner } from "@/components/admin/feedback";

export function TwoFactorSettings({ enabled }: { enabled: boolean }) {
  const [totpEnabled, setTotpEnabled] = useState(enabled);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [manualKey, setManualKey] = useState<string | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function startSetup() {
    setBusy(true);
    setError(null);
    setMessage(null);

    const response = await fetch("/api/admin/totp/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password })
    });
    const data = (await response.json()) as { error?: string; manualKey?: string; qrCodeDataUrl?: string };
    setBusy(false);

    if (!response.ok || !data.manualKey || !data.qrCodeDataUrl) {
      setError(data.error ?? "Two-factor setup could not be started.");
      return;
    }

    setManualKey(data.manualKey);
    setQrCodeDataUrl(data.qrCodeDataUrl);
    setPassword("");
  }

  async function verifySetup() {
    setBusy(true);
    setError(null);
    setMessage(null);

    const response = await fetch("/api/admin/totp/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code })
    });
    const data = (await response.json()) as { error?: string };
    setBusy(false);

    if (!response.ok) {
      setError(data.error ?? "Two-factor setup could not be verified.");
      return;
    }

    setTotpEnabled(true);
    setManualKey(null);
    setQrCodeDataUrl(null);
    setCode("");
    setMessage("Two-factor authentication enabled.");
  }

  async function disable() {
    setBusy(true);
    setError(null);
    setMessage(null);

    const response = await fetch("/api/admin/totp/disable", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password, code })
    });
    const data = (await response.json()) as { error?: string };
    setBusy(false);

    if (!response.ok) {
      setError(data.error ?? "Two-factor authentication could not be disabled.");
      return;
    }

    setTotpEnabled(false);
    setPassword("");
    setCode("");
    setMessage("Two-factor authentication disabled.");
  }

  return (
    <section className="glass rounded-xl p-5">
      <p className="text-xs font-black uppercase tracking-[0.22em] text-[#f6d98f]">Security</p>
      <h2 className="mt-2 text-2xl font-black text-white">Two-Factor Authentication</h2>
      <p className="mt-2 text-sm text-[#aeb7ca]">{totpEnabled ? "Authenticator app verification is enabled." : "Add an authenticator app before production use."}</p>

      {!totpEnabled ? (
        <div className="mt-5 grid gap-4">
          <label>
            <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-[#aeb7ca]">Current Password</span>
            <input
              className="focus-ring h-12 w-full rounded-lg border border-white/10 bg-white/[0.06] px-4 text-white"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
            />
          </label>
          <button className="gold-button focus-ring rounded-lg px-5 py-3 text-sm uppercase tracking-[0.14em] disabled:opacity-60" disabled={busy} onClick={startSetup} type="button">
            {busy ? "Starting..." : "START 2FA SETUP"}
          </button>

          {qrCodeDataUrl && manualKey ? (
            <div className="grid gap-4 rounded-lg border border-white/10 bg-white/[0.04] p-4">
              {/* eslint-disable-next-line @next/next/no-img-element -- QR code is a generated local data URL, not a remote optimizable asset. */}
              <img className="h-48 w-48 rounded-lg bg-white p-2" src={qrCodeDataUrl} alt="Authenticator setup QR code" />
              <p className="break-all text-sm font-bold text-white">{manualKey}</p>
              <label>
                <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-[#aeb7ca]">Authenticator Code</span>
                <input
                  className="focus-ring h-12 w-full rounded-lg border border-white/10 bg-white/[0.06] px-4 text-white"
                  inputMode="numeric"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  autoComplete="one-time-code"
                />
              </label>
              <button className="focus-ring rounded-lg border border-white/12 bg-white/8 px-5 py-3 text-sm font-black text-white hover:bg-white/12 disabled:opacity-60" disabled={busy} onClick={verifySetup} type="button">
                {busy ? "Verifying..." : "VERIFY AND ENABLE"}
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mt-5 grid gap-4">
          <label>
            <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-[#aeb7ca]">Current Password</span>
            <input
              className="focus-ring h-12 w-full rounded-lg border border-white/10 bg-white/[0.06] px-4 text-white"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
            />
          </label>
          <label>
            <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-[#aeb7ca]">Authenticator Code</span>
            <input
              className="focus-ring h-12 w-full rounded-lg border border-white/10 bg-white/[0.06] px-4 text-white"
              inputMode="numeric"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              autoComplete="one-time-code"
            />
          </label>
          <button className="danger-control focus-ring rounded-lg border px-5 py-3 text-sm font-black uppercase tracking-[0.14em] disabled:opacity-60" disabled={busy} onClick={disable} type="button">
            {busy ? "Disabling..." : "DISABLE 2FA"}
          </button>
        </div>
      )}

      {error ? <p className="danger-banner mt-4 rounded-lg px-4 py-3 text-sm font-semibold">{error}</p> : null}
      <SuccessBanner message={message} />
    </section>
  );
}
