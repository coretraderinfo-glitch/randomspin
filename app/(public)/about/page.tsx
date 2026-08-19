import { BrandMark } from "@/components/ui/BrandMark";

export const metadata = {
  title: "About",
  description: "About Lucky Spin, a free online random number wheel."
};

export default function AboutPage() {
  return (
    <main className="premium-shell min-h-screen px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <BrandMark />
        <h1 className="mt-12 font-[var(--font-display)] text-5xl font-black text-white">About Lucky Spin</h1>
        <p className="mt-6 leading-8 text-[#aeb7ca]">
          Lucky Spin is a free random number wheel for games, giveaways, group choices, and quick decisions. Visitors choose a number range, the server selects the result, and the wheel presents it with a polished animation.
        </p>
      </div>
    </main>
  );
}
