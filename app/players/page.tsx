import { headers } from "next/headers";
import { LuckyPlayerHome } from "@/components/public/LuckyPlayerHome";

export const dynamic = "force-dynamic";

export default async function LuckyPlayerPage() {
  const nonce = (await headers()).get("x-nonce") ?? undefined;

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
      <LuckyPlayerHome />
    </>
  );
}
