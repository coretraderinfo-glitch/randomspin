import { randomUUID } from "node:crypto";
import { Prisma, PrismaClient } from "@prisma/client";
import { serializeAuditMetadata } from "../lib/audit-metadata";
import { normalizeExcludedNumbers } from "../lib/excluded-numbers";

const prisma = new PrismaClient();

const requiredTables = [
  "AdminUser",
  "AdminSession",
  "WheelConfiguration",
  "SpinResult",
  "PrivateDraw",
  "PrivateDrawSpinResult",
  "SiteSettings",
  "AuditLog"
];

function requireEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required for staging verification.`);
  }

  return value;
}

function logPass(message: string) {
  console.log(`PASS ${message}`);
}

async function main() {
  requireEnv("DATABASE_URL");
  requireEnv("DIRECT_URL");
  requireEnv("NEXTAUTH_SECRET");
  requireEnv("ADMIN_BOOTSTRAP_EMAIL");
  requireEnv("ADMIN_BOOTSTRAP_PASSWORD");
  requireEnv("NEXT_PUBLIC_SITE_URL");
  requireEnv("UPSTASH_REDIS_REST_URL");
  requireEnv("UPSTASH_REDIS_REST_TOKEN");

  await prisma.$connect();
  logPass("database connection succeeded");

  const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN (${Prisma.join(requiredTables)})
  `;
  const existingTables = new Set(tables.map((table) => table.table_name));
  const missingTables = requiredTables.filter((table) => !existingTables.has(table));

  if (missingTables.length > 0) {
    throw new Error(`Missing required tables: ${missingTables.join(", ")}`);
  }

  logPass("required tables exist");

  const [wheel, settings, adminCount] = await Promise.all([
    prisma.wheelConfiguration.findFirst({ where: { isActive: true }, orderBy: { createdAt: "asc" } }),
    prisma.siteSettings.findFirst({ orderBy: { createdAt: "asc" } }),
    prisma.adminUser.count()
  ]);

  if (!wheel) {
    throw new Error("No active wheel configuration found.");
  }

  if (!settings) {
    throw new Error("No SiteSettings row found.");
  }

  if (adminCount < 1) {
    throw new Error("No admin user found. Run npm run admin:bootstrap in the staging environment.");
  }

  logPass(`active wheel configuration exists (${wheel.minNumber}-${wheel.maxNumber})`);
  logPass(`SiteSettings exists and timezone is readable (${settings.timezone})`);
  logPass("admin user exists");

  const verificationId = `staging-verify-${randomUUID()}`;
  const excluded = new Set(normalizeExcludedNumbers(wheel.excludedNumbers));
  const eligibleNumbers = Array.from({ length: wheel.maxNumber - wheel.minNumber + 1 }, (_, index) => wheel.minNumber + index).filter(
    (number) => !excluded.has(number)
  );

  if (eligibleNumbers.length === 0) {
    throw new Error("Active wheel has no eligible numbers.");
  }

  let spinId: string | null = null;
  let auditId: string | null = null;

  try {
    const spin = await prisma.spinResult.create({
      data: {
        wheelConfigurationId: wheel.id,
        requestedMin: wheel.minNumber,
        requestedMax: wheel.maxNumber,
        winningNumber: eligibleNumbers[0],
        eligibleCount: eligibleNumbers.length,
        hashedIp: verificationId,
        userAgent: "lucky-spin-staging-verification"
      }
    });
    spinId = spin.id;

    const readSpin = await prisma.spinResult.findUnique({ where: { id: spin.id } });
    if (!readSpin) {
      throw new Error("Verification spin write/read failed.");
    }

    logPass("spin write/read succeeded with a marked verification row");

    const audit = await prisma.auditLog.create({
      data: {
        action: "STAGING_VERIFICATION",
        target: "System",
        metadata: serializeAuditMetadata({ verificationId })
      }
    });
    auditId = audit.id;

    const readAudit = await prisma.auditLog.findUnique({ where: { id: audit.id } });
    if (!readAudit) {
      throw new Error("Verification audit log write/read failed.");
    }

    logPass("audit log write/read succeeded with a marked verification row");
  } finally {
    if (auditId) {
      await prisma.auditLog.deleteMany({ where: { id: auditId, action: "STAGING_VERIFICATION" } });
    }

    if (spinId) {
      await prisma.spinResult.deleteMany({ where: { id: spinId, hashedIp: verificationId } });
    }
  }

  logPass("verification rows cleaned up safely");
  console.log("Staging verification complete.");
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
