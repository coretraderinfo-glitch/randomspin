import { BrandMark } from "@/components/ui/BrandMark";

export const metadata = {
  title: "Terms",
  description: "Lucky Spin terms of use."
};

export default function TermsPage() {
  return (
    <main className="premium-shell min-h-screen px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <BrandMark />
        <h1 className="mt-12 font-[var(--font-display)] text-5xl font-black text-white">Terms</h1>
        <div className="mt-6 space-y-4 leading-8 text-[#aeb7ca]">
          <p>Lucky Spin is an entertainment and random-selection tool. It is not licensed gambling software and must not be used for real-money wagering.</p>
          <p>Results are selected from the configured eligible number pool. Users are responsible for deciding whether the tool fits their activity.</p>
          <p>The service may be updated, paused, or placed in maintenance mode by the site owner.</p>
        </div>
      </div>
    </main>
  );
}
