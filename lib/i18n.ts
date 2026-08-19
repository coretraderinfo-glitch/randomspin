export const supportedLocales = ["en", "zh", "ms"] as const;
export type SupportedLocale = (typeof supportedLocales)[number];

export const defaultLocale: SupportedLocale = "en";

export const publicCopy = {
  en: {
    spin: "Spin",
    spinAgain: "Spin Again",
    recentResults: "Recent Results"
  }
} as const;
