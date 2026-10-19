import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { LuckyPlayerHome } from "@/components/public/LuckyPlayerHome";
import { getCurrentAdmin } from "@/lib/auth";
import { getPlayerDrawAudience } from "@/lib/player-draws";

export const dynamic = "force-dynamic";

function normalizePublicCode(value: string) {
  const publicCode = decodeURIComponent(value).trim().toUpperCase();

  if (!/^[A-Z0-9-]{4,32}$/.test(publicCode)) {
    notFound();
  }

  return publicCode;
}

export default async function PlayerDrawAudiencePage({ params }: { params: Promise<{ publicCode: string }> }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const { publicCode: rawPublicCode } = await params;
  const publicCode = normalizePublicCode(rawPublicCode);
  const [draw, adminSession] = await Promise.all([getPlayerDrawAudience(publicCode), getCurrentAdmin()]);

  if (!draw) {
    notFound();
  }

  return (
    <>
      <script
        nonce={nonce}
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: "RandomSpin Player Draw",
            applicationCategory: "EntertainmentApplication",
            offers: { "@type": "Offer", price: "0", priceCurrency: "USD" }
          })
        }}
      />
      <LuckyPlayerHome
        initialParticipants={draw.participants}
        mode={{
          kind: "private",
          publicCode,
          spinEndpoint: `/api/player-draw/${encodeURIComponent(publicCode)}/spin`,
          label: draw.label,
          eventName: draw.name,
          participantCount: draw.participantCount,
          eligibleCount: draw.eligibleCount,
          removeWinnerAfterWin: draw.removeWinnerAfterWin,
          showParticipantList: draw.showParticipantList,
          canOperate: Boolean(adminSession)
        }}
      />
    </>
  );
}
