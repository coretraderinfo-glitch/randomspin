"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, Download, Save, Search, Trash2 } from "lucide-react";
import { SuccessBanner, normalizeFeedbackMessage } from "@/components/admin/feedback";

type Participant = {
  id: string;
  displayName: string;
  reference: string | null;
  isEligible: boolean;
};

type PlayerDrawState = {
  id: string;
  publicCode: string;
  name: string;
  mode: "RANDOM" | "OPERATOR";
  pendingOperatorParticipantId: string | null;
  isActive: boolean;
  removeWinnerAfterWin: boolean;
  showParticipantList: boolean;
  showReferencesPublicly: boolean;
  revision: string;
  participants: Participant[];
};

type DrawResponse = {
  message?: string;
  error?: string;
  draw?: Partial<PlayerDrawState> & { updatedAt?: string };
};

type ParticipantResponse = {
  error?: string;
  participants?: Participant[];
  revision?: string | null;
};

function createLocalId() {
  return globalThis.crypto?.randomUUID?.() ?? `participant-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function clean(value: string, max = 120) {
  return value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

function parseParticipants(text: string): Participant[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.split(",").map((cell) => clean(cell.replace(/^"|"$/g, ""))))
    .filter((row) => row[0] && row[0].toLowerCase() !== "name")
    .slice(0, 1000)
    .map((row) => ({ id: createLocalId(), displayName: row[0], reference: row[1] || null, isEligible: true }));
}

function getDuplicateOrdinals(participants: Participant[]) {
  const totals = new Map<string, number>();
  const seen = new Map<string, number>();

  for (const participant of participants) {
    const key = participant.displayName.trim().toLowerCase();
    totals.set(key, (totals.get(key) ?? 0) + 1);
  }

  return new Map(
    participants.map((participant) => {
      const key = participant.displayName.trim().toLowerCase();
      const next = (seen.get(key) ?? 0) + 1;
      seen.set(key, next);
      return [participant.id, (totals.get(key) ?? 0) > 1 ? next : null] as const;
    })
  );
}

function participantDisplayDetail(participant: Participant, duplicateOrdinals: Map<string, number | null>) {
  if (participant.reference) {
    return participant.reference;
  }

  const duplicateOrdinal = duplicateOrdinals.get(participant.id);
  return duplicateOrdinal ? `#${duplicateOrdinal}` : null;
}

export function PlayerDrawControlForm({ draw }: { draw: PlayerDrawState }) {
  const [state, setState] = useState(draw);
  const [pasteText, setPasteText] = useState("");
  const [query, setQuery] = useState("");
  const [nextWinnerParticipantId, setNextWinnerParticipantId] = useState(draw.pendingOperatorParticipantId ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingParticipants, setSavingParticipants] = useState(false);
  const [participantDirty, setParticipantDirty] = useState(false);
  const [savingAction, setSavingAction] = useState<"save" | "set" | "clear" | null>(null);

  useEffect(() => {
    if (!message) {
      return;
    }

    const timer = window.setTimeout(() => setMessage(null), 4000);
    return () => window.clearTimeout(timer);
  }, [message]);
  const eligibleParticipants = state.participants.filter((participant) => participant.isEligible);
  const isBusy = saving || savingParticipants;
  const filteredParticipants = state.participants
    .filter((participant) => `${participant.displayName} ${participant.reference ?? ""}`.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 240);
  const duplicateOrdinals = useMemo(() => getDuplicateOrdinals(state.participants), [state.participants]);
  const pendingParticipant = useMemo(
    () => state.participants.find((participant) => participant.id === state.pendingOperatorParticipantId) ?? null,
    [state.participants, state.pendingOperatorParticipantId]
  );

  async function copyAudienceLink() {
    const origin = typeof window === "undefined" ? "" : window.location.origin;
    await navigator.clipboard.writeText(`${origin}/players/${state.publicCode}`);
    setMessage("Audience link copied.");
  }

  async function save(action: "save" | "set" | "clear" = "save") {
    if (participantDirty) {
      setError("Save participant changes before updating draw settings.");
      return;
    }

    setSaving(true);
    setSavingAction(action);
    setMessage(null);
    setError(null);

    const response = await fetch(`/api/admin/player-draws/${state.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: state.name,
        mode: state.mode,
        isActive: state.isActive,
        removeWinnerAfterWin: state.removeWinnerAfterWin,
        showParticipantList: state.showParticipantList,
        showReferencesPublicly: state.showReferencesPublicly,
        nextWinnerParticipantId: action === "set" ? nextWinnerParticipantId : undefined,
        action
      })
    });
    const data = (await response.json()) as DrawResponse;

    setSaving(false);
    setSavingAction(null);

    if (!response.ok || !data.draw) {
      setError(data.error ?? "Player draw settings could not be saved.");
      return;
    }

    setState((current) => ({
      ...current,
      name: data.draw?.name ?? current.name,
      mode: data.draw?.mode ?? current.mode,
      isActive: data.draw?.isActive ?? current.isActive,
      removeWinnerAfterWin:
        data.draw?.removeWinnerAfterWin ?? current.removeWinnerAfterWin,
      showParticipantList:
        data.draw?.showParticipantList ?? current.showParticipantList,
      showReferencesPublicly:
        data.draw?.showReferencesPublicly ?? current.showReferencesPublicly,
      ...(data.draw?.updatedAt && data.draw.participants
        ? {
            participants: data.draw.participants,
            revision: data.draw.updatedAt,
          }
        : {}),
      pendingOperatorParticipantId:
        action === "clear" ? null : action === "set" ? nextWinnerParticipantId : data.draw?.pendingOperatorParticipantId ?? current.pendingOperatorParticipantId
    }));
    if (action === "clear") {
      setNextWinnerParticipantId("");
    }
    setMessage(action === "set" ? "Next winner set successfully." : action === "clear" ? "Next winner cleared." : normalizeFeedbackMessage(data.message, "Player draw settings saved."));
  }

  async function saveParticipants() {
    setSavingParticipants(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(`/api/admin/player-draws/${state.id}/participants`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          revision: state.revision,
          participants: state.participants.map(({ id, displayName, reference }) => ({
            id,
            displayName,
            reference,
          })),
        }),
      });
      const data = (await response.json()) as ParticipantResponse;

      if (response.status === 409 && data.participants && data.revision) {
        setState((current) => ({
          ...current,
          participants: data.participants ?? current.participants,
          revision: data.revision ?? current.revision,
        }));
        setParticipantDirty(false);
        setError("Player list changed on another device. Review the refreshed list and try again.");
        return;
      }
      if (!response.ok || !data.participants || !data.revision) {
        setError(data.error ?? "Participants could not be saved.");
        return;
      }

      setState((current) => ({
        ...current,
        participants: data.participants ?? current.participants,
        revision: data.revision ?? current.revision,
      }));
      setParticipantDirty(false);
      setMessage("Participants saved.");
    } catch {
      setError("Participants could not be saved.");
    } finally {
      setSavingParticipants(false);
    }
  }

  function addPastedParticipants() {
    const parsed = parseParticipants(pasteText);
    if (parsed.length === 0) {
      setError("Paste at least one name.");
      return;
    }

    setState((current) => ({ ...current, participants: [...current.participants, ...parsed].slice(0, 1000) }));
    setParticipantDirty(true);
    setPasteText("");
    setError(null);
    setMessage(`${parsed.length} participants added.`);
  }

  function updateParticipant(id: string, patch: Partial<Participant>) {
    setState((current) => ({
      ...current,
      participants: current.participants.map((participant) => (participant.id === id ? { ...participant, ...patch } : participant))
    }));
    setParticipantDirty(true);
  }

  return (
    <div className="grid gap-5">
      <section className="glass rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#f6d98f]">Player Draw Control</p>
            <h2 className="mt-2 text-2xl font-black text-white">{state.name}</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="focus-ring flex items-center gap-2 rounded-lg border border-white/12 bg-white/8 px-4 py-3 text-sm font-bold text-white hover:bg-white/12" type="button" onClick={copyAudienceLink}>
              <Copy className="size-4" />
              Audience Link
            </button>
            <a className="focus-ring flex items-center gap-2 rounded-lg border border-white/12 bg-white/8 px-4 py-3 text-sm font-bold text-white hover:bg-white/12" href={`/api/admin/player-draws/${state.id}/export`}>
              <Download className="size-4" />
              Export CSV
            </a>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <label>
            <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-[#aeb7ca]">Draw Name</span>
            <input className="focus-ring h-12 w-full rounded-lg border border-white/10 bg-white/[0.06] px-4 text-white" value={state.name} disabled={isBusy} onChange={(event) => setState((current) => ({ ...current, name: event.target.value }))} />
          </label>
          <label>
            <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-[#aeb7ca]">Mode</span>
            <select className="focus-ring h-12 w-full rounded-lg border border-white/10 bg-white/[0.06] px-4 text-white" value={state.mode} disabled={isBusy} onChange={(event) => setState((current) => ({ ...current, mode: event.target.value as "RANDOM" | "OPERATOR" }))}>
              <option value="RANDOM">Random</option>
              <option value="OPERATOR">Operator Winner</option>
            </select>
          </label>
          <label>
            <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-[#aeb7ca]">Status</span>
            <select className="focus-ring h-12 w-full rounded-lg border border-white/10 bg-white/[0.06] px-4 text-white" value={state.isActive ? "true" : "false"} disabled={isBusy} onChange={(event) => setState((current) => ({ ...current, isActive: event.target.value === "true" }))}>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </label>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {[
            ["removeWinnerAfterWin", "Remove Winner After Win"],
            ["showParticipantList", "Show Participant List"],
            ["showReferencesPublicly", "Show References Publicly"]
          ].map(([key, label]) => (
            <label key={key} className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold text-white">
              <input
                type="checkbox"
                checked={Boolean(state[key as keyof PlayerDrawState])}
                disabled={isBusy}
                onChange={(event) => setState((current) => ({ ...current, [key]: event.target.checked }))}
              />
              {label}
            </label>
          ))}
        </div>

        {state.mode === "OPERATOR" ? (
          <div className="mt-5 rounded-lg border border-[rgba(246,217,143,0.18)] bg-[rgba(246,217,143,0.06)] p-4">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#f6d98f]">Next Winner</p>
            <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto_auto]">
              <select className="focus-ring h-12 rounded-lg border border-white/10 bg-white/[0.06] px-4 text-white" value={nextWinnerParticipantId} disabled={isBusy} onChange={(event) => setNextWinnerParticipantId(event.target.value)}>
                <option value="">Choose eligible participant</option>
                {eligibleParticipants.map((participant) => (
                  <option key={participant.id} value={participant.id}>
                    {participant.displayName}{participant.reference ? ` - ${participant.reference}` : ""}
                  </option>
                ))}
              </select>
              <button className="gold-button focus-ring rounded-lg px-5 py-3 text-sm uppercase tracking-[0.14em] disabled:opacity-60" type="button" disabled={isBusy || participantDirty || !nextWinnerParticipantId} onClick={() => void save("set")}>
                {savingAction === "set" ? "Setting..." : "SET NEXT WINNER"}
              </button>
              <button className="focus-ring rounded-lg border border-white/12 bg-white/8 px-5 py-3 text-sm font-black text-white hover:bg-white/12 disabled:opacity-60" type="button" disabled={isBusy || participantDirty} onClick={() => void save("clear")}>
                {savingAction === "clear" ? "Clearing..." : "CLEAR"}
              </button>
            </div>
            <p className="mt-3 text-sm text-[#aeb7ca]">
              Pending: {pendingParticipant ? `${pendingParticipant.displayName}${pendingParticipant.reference ? ` - ${pendingParticipant.reference}` : ""}` : "None"}
            </p>
          </div>
        ) : null}

        <button className="gold-button focus-ring mt-5 flex items-center gap-2 rounded-lg px-5 py-3 text-sm uppercase tracking-[0.14em] disabled:opacity-60" type="button" disabled={isBusy || participantDirty} onClick={() => void save("save")}>
          <Save className="size-4" />
          {savingAction === "save" ? "Saving..." : "SAVE SETTINGS"}
        </button>
        {error ? <p className="danger-banner mt-4 rounded-lg px-4 py-3 text-sm font-semibold">{error}</p> : null}
        <SuccessBanner message={message} />
        {participantDirty ? <p className="mt-3 text-sm text-[#f6d98f]">Save participant changes before updating draw settings.</p> : null}
      </section>

      <section className="glass rounded-xl p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#f6d98f]">Participants</p>
            <p className="mt-2 text-sm text-[#aeb7ca]">{state.participants.length} total · {eligibleParticipants.length} eligible</p>
          </div>
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#8f9bb4]" />
            <input className="focus-ring h-10 rounded-lg border border-white/10 bg-white/[0.06] pl-9 pr-3 text-sm text-white" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search" />
          </label>
        </div>

        <div className="grid gap-3">
          <textarea className="focus-ring min-h-24 rounded-lg border border-white/10 bg-white/[0.06] px-4 py-3 text-white" value={pasteText} disabled={isBusy} onChange={(event) => setPasteText(event.target.value)} placeholder="Paste names or Name,Reference CSV rows" />
          <button className="focus-ring w-fit rounded-lg border border-white/12 bg-white/8 px-4 py-3 text-sm font-black text-white hover:bg-white/12 disabled:opacity-60" type="button" disabled={isBusy} onClick={addPastedParticipants}>
            Add Pasted Participants
          </button>
          <button className="gold-button focus-ring w-fit rounded-lg px-4 py-3 text-sm uppercase tracking-[0.14em] disabled:opacity-60" type="button" disabled={isBusy} onClick={() => void saveParticipants()}>
            {savingParticipants ? "Saving Participants..." : "SAVE PARTICIPANTS"}
          </button>
        </div>

        <div className="mt-5 grid max-h-[32rem] gap-2 overflow-auto pr-1">
          {filteredParticipants.map((participant) => {
            const detail = participantDisplayDetail(participant, duplicateOrdinals);

            return (
              <div key={participant.id} className="grid gap-2 rounded-lg border border-white/10 bg-white/[0.04] p-3 md:grid-cols-[1fr_0.55fr_auto_auto]">
                <label>
                  <span className="mb-1 block text-[0.68rem] font-black uppercase tracking-[0.14em] text-[#8f9bb4]">
                    Name{detail ? <span className="ml-2 normal-case tracking-normal text-[#dfe6f6]">· {detail}</span> : null}
                  </span>
                  <input className="focus-ring h-10 w-full rounded-lg border border-white/10 bg-white/[0.06] px-3 text-white" value={participant.displayName} disabled={isBusy} onChange={(event) => updateParticipant(participant.id, { displayName: event.target.value })} />
                </label>
                <label>
                  <span className="mb-1 block text-[0.68rem] font-black uppercase tracking-[0.14em] text-[#8f9bb4]">Reference</span>
                  <input className="focus-ring h-10 w-full rounded-lg border border-white/10 bg-white/[0.06] px-3 text-white" value={participant.reference ?? ""} disabled={isBusy} onChange={(event) => updateParticipant(participant.id, { reference: event.target.value || null })} placeholder="Reference" />
                </label>
                <p className="px-2 text-sm font-bold text-white md:pt-5" aria-label={`${participant.displayName} eligibility`}>
                  {participant.isEligible ? "Eligible" : "Ineligible"}
                </p>
                <button className="danger-control focus-ring grid size-10 place-items-center rounded-lg border md:mt-5 disabled:opacity-60" type="button" disabled={isBusy} onClick={() => {
                  setState((current) => ({ ...current, participants: current.participants.filter((item) => item.id !== participant.id) }));
                  setParticipantDirty(true);
                }} aria-label={`Remove ${participant.displayName}`}>
                  <Trash2 className="size-4" />
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
