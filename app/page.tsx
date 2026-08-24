import { headers } from "next/headers";
import { PublicHome } from "@/components/public/PublicHome";
import { MAX_DRAW_RANGE_SIZE } from "@/lib/draw-range";
import { getRecentPublicResults, getSiteSettings } from "@/lib/public-data";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const [settings, recent] = await Promise.all([getSiteSettings(), getRecentPublicResults()]);

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
          defaultFrom: settings.defaultFrom,
          defaultTo: settings.defaultTo,
          maximumAllowedRange: MAX_DRAW_RANGE_SIZE,
          publicDisclosureMessage: settings.publicDisclosureMessage
        }}
        initialResults={recent}
      />
    </>
  );
}
