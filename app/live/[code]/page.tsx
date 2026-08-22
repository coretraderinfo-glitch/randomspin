import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { PublicHome } from "@/components/public/PublicHome";
import { PRIVATE_DRAW_MAXIMUM_RANGE, getPrivateDrawAudience, getPrivateDrawLivePath } from "@/lib/private-draws";
import { getSiteSettings } from "@/lib/public-data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false
  }
};

function normalizeLiveCode(value: string) {
  const liveCode = decodeURIComponent(value).trim();

  if (!/^[a-zA-Z0-9-]{3,40}$/.test(liveCode)) {
    notFound();
  }

  return liveCode;
}

export default async function PrivateDrawLivePage({ params }: { params: Promise<{ code: string }> }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const { code: rawCode } = await params;
  const liveCode = normalizeLiveCode(rawCode);
  const [settings, draw] = await Promise.all([getSiteSettings(), getPrivateDrawAudience(liveCode)]);

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

  const canonicalPath = getPrivateDrawLivePath(draw);
  const spinCode = draw.liveSlug ?? draw.publicCode;

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
          publicCode: draw.publicCode,
          label: draw.label,
          displayStyle: draw.displayStyle,
          spinEndpoint: `/api/draw/${encodeURIComponent(spinCode)}/spin`,
          sharePath: canonicalPath
        }}
      />
    </>
  );
}
