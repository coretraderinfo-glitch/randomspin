import type { Metadata } from "next";
import { connection } from "next/server";
import "./globals.css";
import { getSiteUrl, isPublicIndexingDisabled } from "@/lib/env";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: "RandomSpin - Free Random Draws for Names, Numbers, and More",
    template: "%s | RandomSpin"
  },
  description:
    "RandomSpin is a free web-based random draw tool for names, numbers, and more. Spin number draws, pick random players, and run simple live draws.",
  keywords: [
    "RandomSpin",
    "Random Draw Tool",
    "Random Number Wheel",
    "Random Number Generator",
    "Random Number Picker",
    "Random Name Picker",
    "Spin the Wheel",
    "Free Random Draw",
    "Online Random Spin",
    "Number Wheel",
    "Player Draw"
  ],
  alternates: { canonical: "/" },
  openGraph: {
    title: "RandomSpin - Free Random Draws",
    description: "A free web-based random draw platform for names, numbers, and more.",
    url: "/",
    siteName: "RandomSpin",
    type: "website",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "RandomSpin - Free Random Draws" }]
  },
  twitter: {
    card: "summary_large_image",
    title: "RandomSpin - Free Random Draws for Names, Numbers, and More",
    description: "Spin numbers, pick names, and run simple random draws in a clean web experience.",
    images: ["/opengraph-image"]
  },
  robots: {
    index: !isPublicIndexingDisabled(),
    follow: !isPublicIndexingDisabled()
  }
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await connection();

  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
