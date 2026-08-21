"use client";

import { useMemo, useState } from "react";
import { Check, Copy, ExternalLink, Save, X } from "lucide-react";

type DrawState = {
  id: string;
  name: string;
  publicCode: string;
  minNumber: number;
  maxNumber: number;
  excludedNumbers: number[];
  mode: "RANDOM" | "OPERATOR";
  displayStyle: "WHEEL" | "NUMBER_ROLLER" | "SLOT_NUMBER" | "CARD_REVEAL";
  pendingOperatorWinner: number | null;
  isActive: boolean;
};

type DrawControlFormProps = {
  draw: DrawState;
};

type DrawResponse = {
  message?: string;
  error?: string;
  draw?: DrawState;
};

function parseExcludedText(value: string) {
  if (!value.trim()) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .split(",")
        .map((item) => Number(item.trim()))
        .filter((item) => Number.isInteger(item))
    )
  ).sort((a, b) => a - b);
}

export function DrawControlForm({ draw }: DrawControlFormProps) {
  const [name, setName] = useState(draw.name);
  const [minNumber, setMinNumber] = useState(draw.minNumber);
  const [maxNumber, setMaxNumber] = useState(draw.maxNumber);
  const [excludedText, setExcludedText] = useState(draw.excludedNumbers.join(","));
  const [mode, setMode] = useState(draw.mode);
  const [displayStyle, setDisplayStyle] = useState(draw.displayStyle);
  const [isActive, setIsActive] = useState(draw.isActive);
  const [pendingOperatorWinner, setPendingOperatorWinner] = useState(draw.pendingOperatorWinner);
  const [nextWinner, setNextWinner] = useState(draw.pendingOperatorWinner?.toString() ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const excludedNumbers = useMemo(() => parseExcludedText(excludedText), [excludedText]);
  const numbers = useMemo(() => {
    if (maxNumber < minNumber || maxNumber - minNumber > 119) {
      return [];
    }

    return Array.from({ length: maxNumber - minNumber + 1 }, (_, index) => minNumber + index);
  }, [minNumber, maxNumber]);
  const audiencePath = `/draw/${draw.publicCode}`;

  function toggleExcluded(value: number) {
    const next = excludedNumbers.includes(value)
      ? excludedNumbers.filter((item) => item !== value)
      : [...excludedNumbers, value].sort((a, b) => a - b);
    setExcludedText(next.join(","));
  }

  async function copyAudienceLink() {
    const origin = typeof window === "undefined" ? "" : window.location.origin;
    await navigator.clipboard.writeText(`${origin}${audiencePath}`);
    setMessage("Audience link copied.");
  }

  function applyServerDraw(serverDraw: DrawState) {
    setName(serverDraw.name);
    setMinNumber(serverDraw.minNumber);
    setMaxNumber(serverDraw.maxNumber);
    setExcludedText(serverDraw.excludedNumbers.join(","));
    setMode(serverDraw.mode);
    setDisplayStyle(serverDraw.displayStyle);
    setIsActive(serverDraw.isActive);
    setPendingOperatorWinner(serverDraw.pendingOperatorWinner);
    setNextWinner(serverDraw.pendingOperatorWinner?.toString() ?? "");
  }

  async function refreshStatus() {
    setSaving(true);
    setMessage(null);
    setError(null);

    const response = await fetch(`/api/admin/draws/${draw.id}`);
    const data = (await response.json()) as DrawResponse;

    setSaving(false);

    if (!response.ok || !data.draw) {
      setError(data.error ?? "Draw status could not be refreshed.");
      return;
    }

    applyServerDraw(data.draw);
    setMessage("Next winner status refreshed.");
  }

  async function save(action?: "set" | "clear") {
    if (action === "set" && mode !== "OPERATOR") {
      setError("Switch to Operator Winner mode before setting the next winner.");
      setMessage(null);
      return;
    }

    if (action === "set" && !nextWinner.trim()) {
      setError("Enter a next winner before setting it.");
      setMessage(null);
      return;
    }

    setSaving(true);
    setMessage(null);
    setError(null);

    const response = await fetch(`/api/admin/draws/${draw.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        minNumber,
        maxNumber,
        excludedText,
        mode,
        displayStyle,
        isActive,
        action,
        nextWinner: action === "clear" ? null : mode === "OPERATOR" && nextWinner.trim() ? Number(nextWinner) : undefined
      })
    });
    const data = (await response.json()) as DrawResponse;

    setSaving(false);

    if (!response.ok) {
      setError(data.error ?? "Draw settings could not be saved.");
      return;
    }

    if (data.draw) {
      applyServerDraw(data.draw);
    }
    setMessage(
      action === "set" && data.draw?.pendingOperatorWinner != null
        ? `Next winner set: ${data.draw.pendingOperatorWinner}.`
        : action === "clear"
          ? "Next winner cleared."
          : data.message ?? "Draw settings saved."
    );
  }

  return (
    <div className="grid gap-5">
      <section className="glass rounded-xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#f6d98f]">Private Draw</p>
            <h2 className="mt-2 text-2xl font-black text-white">{name}</h2>
            <p className="mt-2 text-sm text-[#aeb7ca]">
              {audiencePath} · {isActive ? "Active" : "Inactive"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="focus-ring flex items-center gap-2 rounded-lg border border-white/12 bg-white/8 px-4 py-3 text-sm font-bold text-white hover:bg-white/12"
              type="button"
              onClick={copyAudienceLink}
            >
              <Copy className="size-4" />
              COPY LINK
            </button>
            <a
              className="focus-ring flex items-center gap-2 rounded-lg border border-white/12 bg-white/8 px-4 py-3 text-sm font-bold text-white hover:bg-white/12"
              href={audiencePath}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink className="size-4" />
              OPEN AUDIENCE VIEW
            </a>
            <a
              className="focus-ring flex items-center gap-2 rounded-lg border border-white/12 bg-white/8 px-4 py-3 text-sm font-bold text-white hover:bg-white/12"
              href={audiencePath}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink className="size-4" />
              PREVIEW
            </a>
          </div>
        </div>
      </section>

      <section className="glass rounded-xl p-5">
        <div className="mb-5">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-[#f6d98f]">Default View</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { value: "WHEEL", label: "Wheel", disabled: false },
              { value: "NUMBER_ROLLER", label: "Number", disabled: false },
              { value: "SLOT_NUMBER", label: "Slot Number", disabled: true },
              { value: "CARD_REVEAL", label: "Card Reveal", disabled: true }
            ].map((item) => (
              <button
                key={item.value}
                className={`focus-ring rounded-lg border px-4 py-3 text-left text-sm font-black transition ${
                  displayStyle === item.value
                    ? "border-[rgba(246,217,143,0.48)] bg-[rgba(246,217,143,0.12)] text-white"
                    : "border-white/10 bg-white/[0.04] text-[#aeb7ca] hover:bg-white/[0.08]"
                } ${item.disabled ? "cursor-not-allowed opacity-55" : ""}`}
                type="button"
                disabled={item.disabled}
                onClick={() => setDisplayStyle(item.value as DrawState["displayStyle"])}
              >
                <span>{item.label}</span>
                {item.disabled ? <span className="mt-1 block text-[0.65rem] uppercase tracking-[0.16em] text-[#f6d98f]">Coming Soon</span> : null}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="sm:col-span-2">
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
        </div>

        <label className="mt-4 block">
          <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-[#aeb7ca]">Excluded Numbers</span>
          <textarea
            className="focus-ring min-h-24 w-full rounded-lg border border-white/10 bg-white/[0.06] px-4 py-3 text-white"
            value={excludedText}
            onChange={(event) => setExcludedText(event.target.value)}
          />
        </label>
        <p className="mt-2 text-sm text-[#aeb7ca]">
          Eligible {Math.max(maxNumber - minNumber + 1 - excludedNumbers.length, 0)} / Excluded {excludedNumbers.length}
        </p>

        {numbers.length > 0 ? (
          <div className="mt-4 grid grid-cols-5 gap-2 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12">
            {numbers.map((number) => {
              const excluded = excludedNumbers.includes(number);
              return (
                <button
                  key={number}
                  className={`focus-ring flex h-12 items-center justify-center gap-1 rounded-lg border text-sm font-black transition ${
                    excluded
                      ? "danger-control line-through"
                      : "border-[rgba(246,217,143,0.22)] bg-[rgba(246,217,143,0.08)] text-white hover:bg-[rgba(246,217,143,0.14)]"
                  }`}
                  type="button"
                  onClick={() => toggleExcluded(number)}
                >
                  {excluded ? <X className="size-3" /> : <Check className="size-3 text-[#f6d98f]" />}
                  {number}
                </button>
              );
            })}
          </div>
        ) : null}
      </section>

      <section className="glass rounded-xl p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-[#aeb7ca]">Draw Mode</span>
            <select
              className="focus-ring h-12 w-full rounded-lg border border-white/10 bg-white/[0.06] px-4 text-white"
              value={mode}
              onChange={(event) => setMode(event.target.value as "RANDOM" | "OPERATOR")}
            >
              <option value="RANDOM">Random</option>
              <option value="OPERATOR">Operator Winner</option>
            </select>
          </label>
          <label className="flex items-end gap-3 rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold text-white">
            <input checked={isActive} type="checkbox" onChange={(event) => setIsActive(event.target.checked)} />
            Active private draw
          </label>
        </div>

        <div className="mt-5 rounded-lg border border-white/10 bg-white/[0.04] p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#f6d98f]">Next Round Winner</p>
              <p className="mt-2 text-sm font-bold text-white">
                {pendingOperatorWinner === null ? "No next winner set" : `Next winner set: ${pendingOperatorWinner}`}
              </p>
              {mode !== "OPERATOR" ? (
                <p className="mt-2 text-sm text-[#aeb7ca]">Switch Draw Mode to Operator Winner before setting a confirmed number.</p>
              ) : null}
            </div>
            <button
              className="focus-ring rounded-lg border border-white/12 bg-white/8 px-4 py-3 text-sm font-black text-white hover:bg-white/12 disabled:opacity-60"
              type="button"
              disabled={saving}
              onClick={() => void refreshStatus()}
            >
              REFRESH STATUS
            </button>
          </div>

          <label className="mt-4 block">
            <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-[#aeb7ca]">Next Confirmed Number</span>
            <input
              className="focus-ring h-12 w-full rounded-lg border border-white/10 bg-white/[0.06] px-4 text-white"
              disabled={mode !== "OPERATOR"}
              inputMode="numeric"
              type="number"
              value={nextWinner}
              onChange={(event) => setNextWinner(event.target.value)}
            />
          </label>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              className="focus-ring rounded-lg border border-white/12 bg-white/8 px-5 py-3 text-sm font-black uppercase tracking-[0.14em] text-white hover:bg-white/12 disabled:opacity-60"
              type="button"
              disabled={saving || mode !== "OPERATOR"}
              onClick={() => void save("set")}
            >
              SET NEXT WINNER
            </button>
            <button
              className="focus-ring rounded-lg border border-white/12 bg-white/8 px-5 py-3 text-sm font-black uppercase tracking-[0.14em] text-white hover:bg-white/12 disabled:opacity-60"
              type="button"
              disabled={saving || mode !== "OPERATOR"}
              onClick={() => void save("clear")}
            >
              CLEAR
            </button>
          </div>

          {mode === "OPERATOR" && numbers.length > 0 ? (
            <div className="mt-4 grid grid-cols-5 gap-2 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12">
              {numbers
                .filter((number) => !excludedNumbers.includes(number))
                .map((number) => (
                  <button
                    key={number}
                    className="focus-ring h-10 rounded-lg border border-[rgba(246,217,143,0.22)] bg-[rgba(246,217,143,0.08)] text-sm font-black text-white hover:bg-[rgba(246,217,143,0.14)]"
                    type="button"
                    onClick={() => setNextWinner(number.toString())}
                  >
                    {number}
                  </button>
                ))}
            </div>
          ) : null}
        </div>

        {error ? <p className="danger-banner mt-4 rounded-lg px-4 py-3 text-sm font-semibold">{error}</p> : null}
        {message ? <p className="mt-4 rounded-lg border border-emerald-300/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{message}</p> : null}

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            className="gold-button focus-ring flex items-center gap-2 rounded-lg px-5 py-3 text-sm uppercase tracking-[0.14em] disabled:opacity-60"
            type="button"
            disabled={saving}
            onClick={() => save()}
          >
            <Save className="size-4" />
            SAVE CHANGES
          </button>
        </div>
      </section>
    </div>
  );
}
