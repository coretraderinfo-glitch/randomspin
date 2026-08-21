"use client";

import { useState } from "react";
import { Copy, ExternalLink, Plus, Save } from "lucide-react";

type DrawItem = {
  id: string;
  publicCode: string;
  name: string;
  minNumber: number;
  maxNumber: number;
  excludedNumbers: number[];
  mode: "RANDOM" | "OPERATOR";
  displayStyle: "WHEEL" | "NUMBER_ROLLER" | "SLOT_NUMBER" | "CARD_REVEAL";
  pendingOperatorWinner: number | null;
  isActive: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
  completedSpins: number;
};

type DrawResponse = {
  message?: string;
  error?: string;
  draw?: DrawItem;
};

function formatDate(value: Date | string) {
  return new Date(value).toLocaleString();
}

export function PrivateDrawManager({ initialDraws }: { initialDraws: DrawItem[] }) {
  const [draws, setDraws] = useState(initialDraws);
  const [name, setName] = useState("Private Event Draw");
  const [minNumber, setMinNumber] = useState(1);
  const [maxNumber, setMaxNumber] = useState(30);
  const [mode, setMode] = useState<"RANDOM" | "OPERATOR">("RANDOM");
  const [displayStyle, setDisplayStyle] = useState<"WHEEL" | "NUMBER_ROLLER">("WHEEL");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function copyLink(publicCode: string) {
    const origin = typeof window === "undefined" ? "" : window.location.origin;
    await navigator.clipboard.writeText(`${origin}/draw/${publicCode}`);
    setMessage("Audience link copied.");
  }

  async function createDraw() {
    setCreating(true);
    setMessage(null);
    setError(null);

    const response = await fetch("/api/admin/draws", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        minNumber,
        maxNumber,
        excludedNumbers: [],
        mode,
        displayStyle,
        isActive: true
      })
    });
    const data = (await response.json()) as DrawResponse;

    setCreating(false);

    if (!response.ok || !data.draw) {
      setError(data.error ?? "Private draw could not be created.");
      return;
    }

    setDraws((current) => [{ ...data.draw!, completedSpins: 0 }, ...current]);
    setMessage(data.message ?? "Private draw created.");
  }

  async function toggleActive(draw: DrawItem) {
    setBusyId(draw.id);
    setMessage(null);
    setError(null);

    const response = await fetch(`/api/admin/draws/${draw.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: draw.name,
        minNumber: draw.minNumber,
        maxNumber: draw.maxNumber,
        excludedNumbers: draw.excludedNumbers,
        mode: draw.mode,
        displayStyle: draw.displayStyle,
        isActive: !draw.isActive
      })
    });
    const data = (await response.json()) as DrawResponse;

    setBusyId(null);

    if (!response.ok || !data.draw) {
      setError(data.error ?? "Private draw could not be updated.");
      return;
    }

    setDraws((current) => current.map((item) => (item.id === draw.id ? { ...item, ...data.draw! } : item)));
    setMessage(data.message ?? "Private draw updated.");
  }

  return (
    <div className="grid gap-5">
      <section className="glass rounded-xl p-5">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#f6d98f]">Create</p>
            <h2 className="mt-2 text-2xl font-black text-white">Private Draw</h2>
          </div>
          <Plus className="size-5 text-[#f6d98f]" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1.4fr_0.6fr_0.6fr_0.8fr_0.9fr]">
          <label>
            <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-[#aeb7ca]">Draw Name</span>
            <input
              className="focus-ring h-12 w-full rounded-lg border border-white/10 bg-white/[0.06] px-4 text-white"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label>
            <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-[#aeb7ca]">From</span>
            <input
              className="focus-ring h-12 w-full rounded-lg border border-white/10 bg-white/[0.06] px-4 text-white"
              type="number"
              value={minNumber}
              onChange={(event) => setMinNumber(Number(event.target.value))}
            />
          </label>
          <label>
            <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-[#aeb7ca]">To</span>
            <input
              className="focus-ring h-12 w-full rounded-lg border border-white/10 bg-white/[0.06] px-4 text-white"
              type="number"
              value={maxNumber}
              onChange={(event) => setMaxNumber(Number(event.target.value))}
            />
          </label>
          <label>
            <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-[#aeb7ca]">Mode</span>
            <select
              className="focus-ring h-12 w-full rounded-lg border border-white/10 bg-white/[0.06] px-4 text-white"
              value={mode}
              onChange={(event) => setMode(event.target.value as "RANDOM" | "OPERATOR")}
            >
              <option value="RANDOM">Random</option>
              <option value="OPERATOR">Operator Winner</option>
            </select>
          </label>
          <label>
            <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-[#aeb7ca]">Default View</span>
            <select
              className="focus-ring h-12 w-full rounded-lg border border-white/10 bg-white/[0.06] px-4 text-white"
              value={displayStyle}
              onChange={(event) => setDisplayStyle(event.target.value as "WHEEL" | "NUMBER_ROLLER")}
            >
              <option value="WHEEL">Wheel</option>
              <option value="NUMBER_ROLLER">Number</option>
            </select>
          </label>
        </div>
        <div className="mt-4">
          <button
            className="gold-button focus-ring flex items-center gap-2 rounded-lg px-5 py-3 text-sm uppercase tracking-[0.14em] disabled:opacity-60"
            type="button"
            disabled={creating}
            onClick={createDraw}
          >
            <Save className="size-4" />
            + CREATE PRIVATE DRAW
          </button>
        </div>
        {error ? <p className="danger-banner mt-4 rounded-lg px-4 py-3 text-sm font-semibold">{error}</p> : null}
        {message ? <p className="mt-4 rounded-lg border border-emerald-300/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{message}</p> : null}
      </section>

      <section className="glass rounded-xl p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-[var(--font-display)] text-2xl font-black text-white">Private Draws</h2>
          <p className="text-sm text-[#aeb7ca]">{draws.length} total</p>
        </div>
        <div className="grid gap-3">
          {draws.length === 0 ? (
            <p className="text-sm text-[#aeb7ca]">No private draws yet.</p>
          ) : (
            draws.map((draw) => (
              <article key={draw.id} className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
                <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-black text-white">{draw.name}</h3>
                      <span className="rounded-full border border-white/12 bg-white/[0.06] px-2 py-1 text-[0.65rem] font-black uppercase tracking-[0.16em] text-[#dfe6f6]">
                        {draw.mode === "OPERATOR" ? "Operator" : "Random"}
                      </span>
                      <span className="rounded-full border border-white/12 bg-white/[0.06] px-2 py-1 text-[0.65rem] font-black uppercase tracking-[0.16em] text-[#dfe6f6]">
                        {draw.isActive ? "Active" : "Inactive"}
                      </span>
                      <span className="rounded-full border border-white/12 bg-white/[0.06] px-2 py-1 text-[0.65rem] font-black uppercase tracking-[0.16em] text-[#dfe6f6]">
                        Default {draw.displayStyle === "NUMBER_ROLLER" ? "Number" : "Wheel"}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-[#aeb7ca]">
                      Code {draw.publicCode} · Range {draw.minNumber}-{draw.maxNumber} · Excluded {draw.excludedNumbers.length} · Spins{" "}
                      {draw.completedSpins}
                    </p>
                    <p className="mt-1 text-sm text-[#aeb7ca]">
                      Created {formatDate(draw.createdAt)} · Updated {formatDate(draw.updatedAt)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    <a
                      className="focus-ring rounded-lg border border-white/12 bg-white/8 px-4 py-3 text-sm font-bold text-white hover:bg-white/12"
                      href={`/admin/draws/${draw.id}`}
                    >
                      OPEN
                    </a>
                    <a
                      className="focus-ring rounded-lg border border-white/12 bg-white/8 px-4 py-3 text-sm font-bold text-white hover:bg-white/12"
                      href={`/admin/draws/${draw.id}`}
                    >
                      EDIT
                    </a>
                    <button
                      className="focus-ring grid size-11 place-items-center rounded-lg border border-white/12 bg-white/8 text-white hover:bg-white/12"
                      type="button"
                      aria-label={`Copy ${draw.name} audience link`}
                      onClick={() => copyLink(draw.publicCode)}
                    >
                      <Copy className="size-4" />
                    </button>
                    <a
                      className="focus-ring grid size-11 place-items-center rounded-lg border border-white/12 bg-white/8 text-white hover:bg-white/12"
                      href={`/draw/${draw.publicCode}`}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Open ${draw.name} audience view`}
                    >
                      <ExternalLink className="size-4" />
                    </a>
                    <button
                      className="focus-ring rounded-lg border border-white/12 bg-white/8 px-4 py-3 text-sm font-bold text-white hover:bg-white/12 disabled:opacity-60"
                      type="button"
                      disabled={busyId === draw.id}
                      onClick={() => toggleActive(draw)}
                    >
                      {draw.isActive ? "DEACTIVATE" : "ACTIVATE"}
                    </button>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
