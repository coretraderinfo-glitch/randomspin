import type { Metadata } from "next";
import "./globals.css";
import { getSiteUrl } from "@/lib/env";

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: "Lucky Spin - Free Online Random Number Wheel",
    template: "%s | Lucky Spin"
  },
  description:
    "Spin a premium random number wheel online. Lucky Spin is a free lucky number spinner, random number picker, and number wheel for games, giveaways, and quick decisions.",
  keywords: [
    "Lucky Spin",
    "Lucky Number Spinner",
    "Random Number Wheel",
    "Random Number Generator",
    "Random Number Picker",
    "Spin the Wheel",
    "Free Lucky Draw",
    "Online Lucky Spin",
    "Number Wheel"
  ],
  alternates: { canonical: "/" },
  openGraph: {
    title: "Lucky Spin - Spin Your Luck",
    description: "A premium free online random number wheel.",
    url: "/",
    siteName: "Lucky Spin",
    type: "website",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Lucky Spin - Spin Your Luck" }]
  },
  twitter: {
    card: "summary_large_image",
    title: "Lucky Spin - Free Online Random Number Wheel",
    description: "Spin a beautiful random number wheel and let the wheel choose.",
    images: ["/opengraph-image"]
  },
  robots: {
    index: true,
    follow: true
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
