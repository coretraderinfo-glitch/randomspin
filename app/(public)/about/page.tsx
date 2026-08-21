import { BrandMark } from "@/components/ui/BrandMark";

export const metadata = {
  title: "About",
  description: "About RandomSpin, a free web-based random draw tool for names, numbers, and more."
};

export default function AboutPage() {
  return (
    <main className="premium-shell min-h-screen px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <BrandMark />
        <h1 className="mt-12 font-[var(--font-display)] text-5xl font-black text-white">About RandomSpin</h1>
        <p className="mt-6 leading-8 text-[#aeb7ca]">
          RandomSpin is a free web-based random draw tool for names, numbers, and more. Use it for number draws, player picks, giveaways, group choices, and simple live presentations.
        </p>
      </div>
    </main>
  );
}
