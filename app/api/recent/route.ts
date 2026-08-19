import { NextResponse } from "next/server";
import { getRecentPublicResults, getSiteSettings } from "@/lib/public-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const settings = await getSiteSettings();
  const results = await getRecentPublicResults(settings.recentResultCount);
  return NextResponse.json({ results });
}
