import { BrandMark } from "@/components/ui/BrandMark";

export const metadata = {
  title: "FAQ",
  description: "Frequently asked questions about the Lucky Spin random number wheel."
};

const faqs = [
  ["Is Lucky Spin free?", "Yes. Lucky Spin is a free online number-selection utility."],
  ["Where is the result chosen?", "The authoritative result is selected on the server before the wheel animation starts."],
  ["Can I use it for giveaways?", "Yes, for casual games, lucky draws, classroom activities, and entertainment. It is not gambling software."],
  ["Why might a range be unavailable?", "The configured eligible number pool may not have available results for that range."]
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
