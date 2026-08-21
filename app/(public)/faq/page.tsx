import { BrandMark } from "@/components/ui/BrandMark";

export const metadata = {
  title: "FAQ",
  description: "Frequently asked questions about RandomSpin random draw tools."
};

const faqs = [
  ["Is RandomSpin free?", "Yes. RandomSpin is a free online random draw utility for names, numbers, and more."],
  ["Where is the result chosen?", "The server determines the result independently of the visual animation."],
  ["Can I use it for giveaways?", "Yes, for casual games, random draws, classroom activities, and entertainment. It is not gambling software."],
  ["Why might a range be unavailable?", "The configured eligible pool may not have available results for that range."]
];

export default function FaqPage() {
  return (
    <main className="premium-shell min-h-screen px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <BrandMark />
        <h1 className="mt-12 font-[var(--font-display)] text-5xl font-black text-white">FAQ</h1>
        <div className="mt-8 grid gap-4">
          {faqs.map(([question, answer]) => (
            <article key={question} className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
              <h2 className="font-bold text-white">{question}</h2>
              <p className="mt-2 leading-7 text-[#aeb7ca]">{answer}</p>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
