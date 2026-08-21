import { BrandMark } from "@/components/ui/BrandMark";
import { getSiteSettings } from "@/lib/public-data";

export const metadata = {
  title: "Privacy",
  description: "RandomSpin privacy information."
};

export default async function PrivacyPage() {
  const settings = await getSiteSettings();

  return (
    <main className="premium-shell min-h-screen px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <BrandMark />
        <h1 className="mt-12 font-[var(--font-display)] text-5xl font-black text-white">Privacy</h1>
        <div className="mt-6 space-y-4 leading-8 text-[#aeb7ca]">
          <p>RandomSpin stores draw records such as requested range, winning result, time, user agent, and a hashed IP address for abuse prevention and analytics.</p>
          <p>Admin login uses secure HTTP-only cookies. Public visitors do not need an account.</p>
          <p>No real-money gambling, deposits, wallets, or betting features are provided.</p>
          {settings.contactEmail ? <p>Contact: {settings.contactEmail}</p> : null}
        </div>
      </div>
    </main>
  );
}
