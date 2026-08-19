import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.wheelConfiguration.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      name: "Default Wheel",
      minNumber: 1,
      maxNumber: 30,
      excludedNumbers: []
    }
  });

  await prisma.siteSettings.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default" }
  });

  const email = process.env.ADMIN_BOOTSTRAP_EMAIL;
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;

  if (email && password) {
    if (password.length < 12) {
      throw new Error("ADMIN_BOOTSTRAP_PASSWORD must be at least 12 characters.");
    }

    await prisma.adminUser.upsert({
      where: { email: email.toLowerCase() },
      update: {},
      create: {
        email: email.toLowerCase(),
        passwordHash: await bcrypt.hash(password, 12)
      }
    });
  }
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
