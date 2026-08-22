import { redirect } from "next/navigation";

export default function AdminIndexPage() {
  redirect("/rs-console/dashboard");
}
