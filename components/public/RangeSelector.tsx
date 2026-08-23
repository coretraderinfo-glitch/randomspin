"use client";

import { Minus, Plus } from "lucide-react";

type RangeSelectorProps = {
  label: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  readOnly?: boolean;
};

export function RangeSelector({ label, value, min = -1_000_000, max = 1_000_000, onChange, readOnly = false }: RangeSelectorProps) {
  function update(next: number) {
    if (readOnly || !Number.isFinite(next) || !Number.isInteger(next)) {
      return;
    }

    onChange(Math.max(min, Math.min(max, next)));
  }

  return (
    <label className="block">
      <span className="mb-2 block text-xs font-bold uppercase tracking-[0.2em] text-[#aeb7ca]">{label}</span>
      <span className="glass grid grid-cols-[44px_minmax(72px,1fr)_44px] items-center overflow-hidden rounded-lg">
        <button
          type="button"
          className="focus-ring grid h-12 place-items-center text-[#f6d98f] transition hover:bg-white/10"
          onClick={() => update(value - 1)}
          aria-label={`Decrease ${label}`}
          disabled={readOnly}
        >
          <Minus className="size-4" />
        </button>
        <input
          className="number-input h-12 w-full border-x border-white/10 bg-transparent px-2 text-center text-xl font-black text-white outline-none"
          type="number"
          inputMode="numeric"
          value={value}
          onChange={(event) => update(Number(event.target.value))}
          readOnly={readOnly}
          aria-readonly={readOnly}
          aria-label={label}
        />
        <button
          type="button"
          className="focus-ring grid h-12 place-items-center text-[#f6d98f] transition hover:bg-white/10"
          onClick={() => update(value + 1)}
          aria-label={`Increase ${label}`}
          disabled={readOnly}
        >
          <Plus className="size-4" />
        </button>
      </span>
    </label>
  );
}
