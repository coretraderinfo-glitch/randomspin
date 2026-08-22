import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { PublicHome } from "@/components/public/PublicHome";
import { PRIVATE_DRAW_MAXIMUM_RANGE, getPrivateDrawAudience } from "@/lib/private-draws";
import { getSiteSettings } from "@/lib/public-data";

export const dynamic = "force-dynamic";

function normalizePublicCode(value: string) {
  const publicCode = decodeURIComponent(value).trim().toUpperCase();

  if (!/^[A-Z0-9-]{4,32}$/.test(publicCode)) {
    notFound();
  }

  return publicCode;
}

export default async function PrivateDrawAudiencePage({ params }: { params: Promise<{ publicCode: string }> }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const { publicCode: rawPublicCode } = await params;
  const publicCode = normalizePublicCode(rawPublicCode);
  const [settings, draw] = await Promise.all([getSiteSettings(), getPrivateDrawAudience(publicCode)]);

  if (!draw) {
    notFound();
  }

  if (settings.maintenanceMode) {
    return (
      <main className="premium-shell grid min-h-screen place-items-center px-4 text-center">
        <div>
          <p className="mb-4 text-xs font-black uppercase tracking-[0.32em] text-[#f6d98f]">RandomSpin</p>
          <h1 className="font-[var(--font-display)] text-5xl font-black uppercase text-white">We&apos;ll be back shortly.</h1>
          <p className="mt-5 text-[#aeb7ca]">The wheel is being polished. Admin access remains available.</p>
        </div>
      </main>
    );
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
            name: "RandomSpin",
            applicationCategory: "EntertainmentApplication",
            offers: { "@type": "Offer", price: "0", priceCurrency: "USD" }
          })
        }}
      />
      <PublicHome
        settings={{
          siteName: settings.siteName,
          headline: settings.headline,
          subtitle: settings.subtitle,
          announcement: settings.announcement,
          soundEnabled: settings.soundEnabled,
          confettiEnabled: settings.confettiEnabled,
          defaultFrom: draw.minNumber,
          defaultTo: draw.maxNumber,
          maximumAllowedRange: PRIVATE_DRAW_MAXIMUM_RANGE,
          publicDisclosureMessage: settings.publicDisclosureMessage
        }}
        initialResults={[]}
        drawMode={{
          kind: "private",
          publicCode,
          label: draw.label,
          displayStyle: draw.displayStyle,
          spinEndpoint: `/api/draw/${encodeURIComponent(publicCode)}/spin`
        }}
      />
    </>
  );
}
