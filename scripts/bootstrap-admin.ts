import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { serializeAuditMetadata } from "../lib/audit-metadata";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_BOOTSTRAP_EMAIL?.toLowerCase();
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;

  if (!email || !password) {
    throw new Error("Set ADMIN_BOOTSTRAP_EMAIL and ADMIN_BOOTSTRAP_PASSWORD before running this command.");
  }

  if (password.length < 12) {
    throw new Error("ADMIN_BOOTSTRAP_PASSWORD must be at least 12 characters.");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.adminUser.upsert({
    where: { email },
    update: { passwordHash },
    create: { email, passwordHash }
  });

  await prisma.auditLog.create({
    data: {
      action: "ADMIN_BOOTSTRAPPED",
      target: "AdminUser",
      metadata: serializeAuditMetadata({ email })
    }
  });

  console.log(`Admin account ready for ${email}`);
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
