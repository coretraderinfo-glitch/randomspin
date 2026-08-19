"use client";

import { useState } from "react";
import { Save } from "lucide-react";

type Settings = {
  siteName: string;
  headline: string;
  subtitle: string;
  announcement: string | null;
  soundEnabled: boolean;
  confettiEnabled: boolean;
  maintenanceMode: boolean;
  recentResultCount: number;
  defaultFrom: number;
  defaultTo: number;
  maximumAllowedRange: number;
  publicDisclosureMessage: string;
  timezone: string;
  contactEmail: string | null;
};

export function SettingsForm({ settings }: { settings: Settings }) {
  const [form, setForm] = useState(settings);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setStatus(null);
    const response = await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    const data = (await response.json()) as { message?: string; error?: string };
    setSaving(false);
    setStatus(response.ok ? data.message ?? "Settings saved." : data.error ?? "Save failed.");
  }

  return (
    <form onSubmit={save} className="glass grid gap-5 rounded-xl p-5">
      {[
        ["siteName", "Site Name"],
        ["headline", "Headline"],
        ["subtitle", "Subtitle"],
        ["announcement", "Announcement"],
        ["publicDisclosureMessage", "Public Disclosure Message"],
        ["timezone", "Timezone"],
        ["contactEmail", "Contact Email"]
      ].map(([key, label]) => (
        <label key={key}>
          <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-[#aeb7ca]">{label}</span>
          <input
            className="focus-ring h-12 w-full rounded-lg border border-white/10 bg-white/[0.06] px-4 text-white"
            value={(form[key as keyof Settings] as string | null) ?? ""}
            onChange={(event) =>
              update(key as keyof Settings, (key === "contactEmail" ? event.target.value || null : event.target.value) as never)
            }
          />
        </label>
      ))}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["recentResultCount", "Recent Count"],
          ["defaultFrom", "Default From"],
          ["defaultTo", "Default To"],
          ["maximumAllowedRange", "Max Range"]
        ].map(([key, label]) => (
          <label key={key}>
            <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-[#aeb7ca]">{label}</span>
            <input
              className="focus-ring h-12 w-full rounded-lg border border-white/10 bg-white/[0.06] px-4 text-white"
              type="number"
              value={form[key as keyof Settings] as number}
              onChange={(event) => update(key as keyof Settings, Number(event.target.value) as never)}
            />
          </label>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["soundEnabled", "Enable Sounds"],
          ["confettiEnabled", "Enable Confetti"],
          ["maintenanceMode", "Maintenance Mode"]
        ].map(([key, label]) => (
          <label key={key} className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.04] p-4 text-sm font-bold text-white">
            <input
              type="checkbox"
              checked={form[key as keyof Settings] as boolean}
              onChange={(event) => update(key as keyof Settings, event.target.checked as never)}
            />
            {label}
          </label>
        ))}
      </div>

      {status ? <p className="text-sm text-[#aeb7ca]">{status}</p> : null}
      <button className="gold-button focus-ring flex w-fit items-center gap-2 rounded-lg px-5 py-3 text-sm uppercase tracking-[0.16em]" disabled={saving}>
        <Save className="size-4" />
        {saving ? "Saving" : "Save Settings"}
      </button>
    </form>
  );
}
