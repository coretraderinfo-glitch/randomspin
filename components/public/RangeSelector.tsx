"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";

export type RangeSelectorHandle = {
  commitDraft: () => number | null;
  restoreDraft: () => void;
  isDirty: () => boolean;
  isEditing: () => boolean;
};

type RangeSelectorProps = {
  label: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  onCommit?: (value: number) => void;
  onEditingChange?: (editing: boolean) => void;
  onDirtyChange?: (dirty: boolean) => void;
  resetKey?: number;
  readOnly?: boolean;
};

function clampValue(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export const RangeSelector = forwardRef<RangeSelectorHandle, RangeSelectorProps>(function RangeSelector(
  { label, value, min = -1_000_000, max = 1_000_000, onChange, onCommit, onEditingChange, onDirtyChange, resetKey = 0, readOnly = false },
  ref
) {
  const [draftText, setDraftText] = useState(String(value));
  const [editing, setEditing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const previousResetKeyRef = useRef(resetKey);

  useEffect(() => {
    if (!editing && !dirty) {
      setDraftText(String(value));
    }
  }, [dirty, editing, value]);

  useEffect(() => {
    if (resetKey === previousResetKeyRef.current) {
      return;
    }

    previousResetKeyRef.current = resetKey;
    setDraftText(String(value));
    setDirty(false);
    setEditing(false);
    onDirtyChange?.(false);
    onEditingChange?.(false);
  }, [onDirtyChange, onEditingChange, resetKey, value]);

  function setEditingState(next: boolean) {
    setEditing(next);
    onEditingChange?.(next);
  }

  function setDirtyState(next: boolean) {
    setDirty(next);
    onDirtyChange?.(next);
  }

  function parseDraft() {
    const trimmed = draftText.trim();
    if (!/^-?\d+$/.test(trimmed)) {
      return null;
    }

    const parsed = Number(trimmed);
    if (!Number.isSafeInteger(parsed)) {
      return null;
    }

    return clampValue(parsed, min, max);
  }

  function commitDraft() {
    if (readOnly) {
      return value;
    }

    const next = parseDraft();
    if (next === null) {
      setDraftText(String(value));
      setDirtyState(false);
      setEditingState(false);
      return null;
    }

    setDraftText(String(next));
    setDirtyState(false);
    setEditingState(false);
    onChange(next);
    onCommit?.(next);
    return next;
  }

  function restoreDraft() {
    setDraftText(String(value));
    setDirtyState(false);
    setEditingState(false);
  }

  useImperativeHandle(
    ref,
    () => ({
      commitDraft,
      restoreDraft,
      isDirty: () => dirty,
      isEditing: () => editing
    })
  );

  function update(next: number) {
    if (readOnly || !Number.isFinite(next) || !Number.isInteger(next)) {
      return;
    }

    const normalized = clampValue(next, min, max);
    setDraftText(String(normalized));
    setDirtyState(false);
    setEditingState(false);
    onChange(normalized);
    onCommit?.(normalized);
  }

  function updateText(next: string) {
    if (readOnly) {
      return;
    }

    if (!/^-?\d*$/.test(next)) {
      return;
    }

    setDraftText(next);
    setDirtyState(next !== String(value));

    if (/^-?\d+$/.test(next)) {
      const parsed = Number(next);
      if (Number.isSafeInteger(parsed)) {
        onChange(clampValue(parsed, min, max));
      }
    }
  }

  function step(delta: number) {
    update((parseDraft() ?? value) + delta);
  }

  return (
    <label className="block">
      <span className="mb-2 block text-xs font-bold uppercase tracking-[0.2em] text-[#aeb7ca]">{label}</span>
      <span className="glass grid grid-cols-[44px_minmax(72px,1fr)_44px] items-center overflow-hidden rounded-lg">
        <button
          type="button"
          className="focus-ring grid h-12 place-items-center text-[#f6d98f] transition hover:bg-white/10"
          onClick={() => step(-1)}
          aria-label={`Decrease ${label}`}
          disabled={readOnly}
        >
          <Minus className="size-4" />
        </button>
        <input
          className="number-input h-12 w-full border-x border-white/10 bg-transparent px-2 text-center text-xl font-black text-white outline-none"
          type="number"
          inputMode="numeric"
          value={draftText}
          onFocus={() => setEditingState(true)}
          onChange={(event) => updateText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commitDraft();
            } else if (event.key === "Escape") {
              event.preventDefault();
              restoreDraft();
            }
          }}
          onBlur={() => {
            if (dirty) {
              commitDraft();
            } else {
              setEditingState(false);
            }
          }}
          readOnly={readOnly}
          aria-readonly={readOnly}
          aria-label={label}
        />
        <button
          type="button"
          className="focus-ring grid h-12 place-items-center text-[#f6d98f] transition hover:bg-white/10"
          onClick={() => step(1)}
          aria-label={`Increase ${label}`}
          disabled={readOnly}
        >
          <Plus className="size-4" />
        </button>
      </span>
    </label>
  );
});
