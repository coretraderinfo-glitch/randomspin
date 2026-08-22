"use client";

import { useRouter } from "next/navigation";

export function LogoutButton({ icon }: { icon: React.ReactNode }) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/rs-console/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={logout}
      className="focus-ring flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm font-bold text-[#aeb7ca] transition hover:bg-white/8 hover:text-white"
    >
      <span className="text-[#f6d98f]">{icon}</span>
      Logout
    </button>
  );
}
