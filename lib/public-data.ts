import "server-only";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/env";

const fallbackSettings = {
  id: "default",
  siteName: "Lucky Spin",
  headline: "SPIN YOUR LUCK",
  subtitle: "Let the wheel choose.",
  announcement: null,
  soundEnabled: true,
  confettiEnabled: true,
  maintenanceMode: false,
  recentResultCount: 10,
  defaultFrom: 1,
  defaultTo: 30,
  maximumAllowedRange: 1000,
  publicDisclosureMessage: "Results are selected from the configured eligible number pool.",
  timezone: "Asia/Kuala_Lumpur",
  contactEmail: null,
  createdAt: new Date(),
  updatedAt: new Date()
};

const fallbackWheel = {
  id: "default",
  name: "Default Wheel",
  minNumber: 1,
  maxNumber: 30,
  excludedNumbers: [] as number[],
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date()
};

export async function getActiveWheelConfiguration() {
  if (!isDatabaseConfigured()) {
    return fallbackWheel;
  }

  const existing = await prisma.wheelConfiguration.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: "asc" }
  });

  if (existing) {
    return existing;
  }

  return prisma.wheelConfiguration.create({
    data: {
      id: "default",
      name: "Default Wheel",
      minNumber: 1,
      maxNumber: 30,
      excludedNumbers: []
    }
  });
}

export async function getSiteSettings() {
  if (!isDatabaseConfigured()) {
    return fallbackSettings;
  }

  return prisma.siteSettings.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default" }
  });
}

export async function getRecentPublicResults(limit = 10) {
  if (!isDatabaseConfigured()) {
    return [];
  }

  const results = await prisma.spinResult.findMany({
    select: {
      winningNumber: true,
      createdAt: true
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(limit, 1), 20)
  });

  return results.map((result) => ({
    winner: result.winningNumber,
    timestamp: result.createdAt.toISOString()
  }));
}
