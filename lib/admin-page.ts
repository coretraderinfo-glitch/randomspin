import "server-only";
import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/auth";

export async function requireAdminPage() {
  const session = await getCurrentAdmin();
  if (!session) {
    redirect("/rs-console/login");
  }

  return session.adminUser;
}
