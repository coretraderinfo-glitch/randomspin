import "server-only";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/env";
import { normalizeExcludedNumbers, serializeExcludedNumbers } from "@/lib/excluded-numbers";

const fallbackSettings = {
  id: "default",
  siteName: "RandomSpin",
  headline: "RandomSpin",
  subtitle: "Free random draws for names, numbers, and more.",
  announcement: null,
  soundEnabled: true,
  confettiEnabled: true,
  maintenanceMode: false,
  recentResultCount: 10,
  defaultFrom: 1,
  defaultTo: 30,
  maximumAllowedRange: 1000,
  publicDisclosureMessage: "Results are selected from the configured eligible pool.",
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
    return {
      ...existing,
      excludedNumbers: normalizeExcludedNumbers(existing.excludedNumbers)
    };
  }

  const created = await prisma.wheelConfiguration.create({
    data: {
      id: "default",
      name: "Default Wheel",
      minNumber: 1,
      maxNumber: 30,
      excludedNumbers: serializeExcludedNumbers([])
    }
  });

  return {
    ...created,
    excludedNumbers: normalizeExcludedNumbers(created.excludedNumbers)
  };
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
