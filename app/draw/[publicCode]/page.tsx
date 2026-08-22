import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

function normalizeLegacyPublicCode(value: string) {
  const publicCode = decodeURIComponent(value).trim();

  if (!/^[a-zA-Z0-9-]{3,40}$/.test(publicCode)) {
    notFound();
  }

  return publicCode;
}

export default async function LegacyPrivateDrawRedirectPage({ params }: { params: Promise<{ publicCode: string }> }) {
  const { publicCode: rawPublicCode } = await params;
  const publicCode = normalizeLegacyPublicCode(rawPublicCode);

  redirect(`/live/${encodeURIComponent(publicCode)}`);
}
