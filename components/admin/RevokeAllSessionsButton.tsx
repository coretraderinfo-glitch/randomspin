"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RevokeAllSessionsButton({ icon }: { icon: React.ReactNode }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function revokeAll() {
    setBusy(true);
    await fetch("/api/admin/sessions/revoke-all", { method: "POST" });
    router.push("/rs-console/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={revokeAll}
      className="focus-ring mt-2 flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-bold text-[#aeb7ca] transition hover:bg-white/8 hover:text-white disabled:opacity-60"
    >
      <span className="text-[#f6d98f]">{icon}</span>
      {busy ? "Ending Sessions..." : "Log Out All Sessions"}
    </button>
  );
}
