export function normalizeFeedbackMessage(value: string | null | undefined, fallback = "") {
  const cleaned = value?.trim();
  return cleaned && cleaned.length > 0 ? cleaned : fallback;
}

export function SuccessBanner({ message }: { message: string | null | undefined }) {
  const cleaned = normalizeFeedbackMessage(message);

  if (!cleaned) {
    return null;
  }

  return <p className="success-banner mt-4 rounded-lg px-4 py-3 text-sm font-semibold">{cleaned}</p>;
}
