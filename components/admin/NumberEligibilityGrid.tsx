"use client";

import { useMemo, useState } from "react";
import { Check, RotateCcw, Save, X } from "lucide-react";

type WheelConfig = {
  minNumber: number;
  maxNumber: number;
  excludedNumbers: number[];
};

export function NumberEligibilityGrid({ config }: { config: WheelConfig }) {
  const [minNumber, setMinNumber] = useState(config.minNumber);
  const [maxNumber, setMaxNumber] = useState(config.maxNumber);
  const [excluded, setExcluded] = useState<number[]>(config.excludedNumbers);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const numbers = useMemo(() => {
    if (maxNumber < minNumber || maxNumber - minNumber > 1000) {
      return [];
    }

    return Array.from({ length: maxNumber - minNumber + 1 }, (_, index) => minNumber + index);
  }, [minNumber, maxNumber]);

  const hasChanges =
    minNumber !== config.minNumber ||
    maxNumber !== config.maxNumber ||
    excluded.join(",") !== config.excludedNumbers.join(",");

  function toggle(value: number) {
    setExcluded((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value].sort((a, b) => a - b)
    );
  }

  function clearExclusions() {
    setExcluded([]);
  }

  function selectAllExcluded() {
    setExcluded(numbers);
  }

  function invertSelection() {
    setExcluded(numbers.filter((number) => !excluded.includes(number)));
  }

  async function save() {
    setSaving(true);
    setStatus(null);

    const response = await fetch("/api/admin/wheel", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ minNumber, maxNumber, excludedNumbers: excluded })
    });
    const data = (await response.json()) as { message?: string; error?: string };

    setSaving(false);
    setStatus(response.ok ? data.message ?? "Wheel configuration updated successfully." : data.error ?? "Save failed.");
  }

  function reset() {
    setMinNumber(config.minNumber);
    setMaxNumber(config.maxNumber);
    setExcluded(config.excludedNumbers);
    setStatus(null);
  }

  return (
    <div className="grid gap-5">
      <div className="glass rounded-xl p-5">
        <div className="grid gap-4 sm:grid-cols-2">
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
            value={excluded.join(",")}
            onChange={(event) => {
              const values = event.target.value
                .split(",")
                .map((item) => Number(item.trim()))
                .filter((item) => Number.isInteger(item));
              setExcluded(Array.from(new Set(values)).sort((a, b) => a - b));
            }}
          />
        </label>
        <div className="mt-4 flex flex-wrap gap-3">
          <button className="focus-ring rounded-lg border border-white/10 bg-white/8 px-4 py-3 text-sm font-bold text-white" onClick={selectAllExcluded}>
            Select All
          </button>
          <button className="focus-ring rounded-lg border border-white/10 bg-white/8 px-4 py-3 text-sm font-bold text-white" onClick={clearExclusions}>
            Clear Exclusions
          </button>
          <button className="focus-ring rounded-lg border border-white/10 bg-white/8 px-4 py-3 text-sm font-bold text-white" onClick={invertSelection}>
            Invert Selection
          </button>
          <button className="focus-ring flex items-center gap-2 rounded-lg border border-white/10 bg-white/8 px-4 py-3 text-sm font-bold text-white" onClick={reset}>
            <RotateCcw className="size-4" />
            Reset
          </button>
          <button className="gold-button focus-ring flex items-center gap-2 rounded-lg px-4 py-3 text-sm uppercase tracking-[0.14em]" onClick={save} disabled={saving}>
            <Save className="size-4" />
            {saving ? "Saving" : "Save Changes"}
          </button>
        </div>
        {hasChanges ? <p className="mt-4 text-sm font-bold text-[#f6d98f]">Unsaved Changes</p> : null}
        {status ? <p className="mt-3 text-sm text-[#aeb7ca]">{status}</p> : null}
      </div>

      <div className="glass rounded-xl p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-[var(--font-display)] text-2xl font-black text-white">Number Eligibility</h2>
          <p className="text-sm text-[#aeb7ca]">
            Eligible {numbers.length - excluded.length} / Excluded {excluded.length}
          </p>
        </div>
        <div className="grid grid-cols-5 gap-2 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12">
          {numbers.map((number) => {
            const isExcluded = excluded.includes(number);
            return (
              <button
                key={number}
                type="button"
                onClick={() => toggle(number)}
                className={`focus-ring flex h-12 items-center justify-center gap-1 rounded-lg border text-sm font-black transition ${
                  isExcluded
                    ? "border-rose-300/20 bg-rose-500/12 text-rose-100 line-through"
                    : "border-[rgba(246,217,143,0.22)] bg-[rgba(246,217,143,0.08)] text-white hover:bg-[rgba(246,217,143,0.14)]"
                }`}
              >
                {isExcluded ? <X className="size-3" /> : <Check className="size-3 text-[#f6d98f]" />}
                {number}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
