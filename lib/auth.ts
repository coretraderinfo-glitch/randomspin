import "server-only";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createOpaqueToken, sha256 } from "@/lib/security";

export const ADMIN_SESSION_COOKIE = "lucky_admin_session";
const SESSION_DAYS = 7;

export async function createAdminSession(adminUserId: string) {
  const token = createOpaqueToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await prisma.adminSession.create({
    data: {
      tokenHash: sha256(token),
      adminUserId,
      expiresAt
    }
  });

  return { token, expiresAt };
}

export function setAdminCookie(response: NextResponse, token: string, expiresAt: Date) {
  response.cookies.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt
  });
}

export async function getCurrentAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  if (!token) {
    return null;
  }

  return prisma.adminSession.findFirst({
    where: {
      tokenHash: sha256(token),
      revokedAt: null,
      expiresAt: { gt: new Date() }
    },
    include: { adminUser: true }
  });
}

export async function requireAdmin() {
  const session = await getCurrentAdmin();
  if (!session) {
    throw new Error("UNAUTHORIZED");
  }

  return session.adminUser;
}

export async function getAdminFromRequest(request: NextRequest) {
  const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  if (!token) {
    return null;
  }

  const session = await prisma.adminSession.findFirst({
    where: {
      tokenHash: sha256(token),
      revokedAt: null,
      expiresAt: { gt: new Date() }
    },
    include: { adminUser: true }
  });

  return session?.adminUser ?? null;
}

export async function revokeCurrentSession(request: NextRequest) {
  const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  if (!token) {
    return;
  }

  await prisma.adminSession.updateMany({
    where: { tokenHash: sha256(token), revokedAt: null },
    data: { revokedAt: new Date() }
  });
}

export async function verifyAdminCredentials(email: string, password: string) {
  const admin = await prisma.adminUser.findUnique({
    where: { email: email.toLowerCase() }
  });

  if (!admin) {
    return null;
  }

  const valid = await bcrypt.compare(password, admin.passwordHash);
  if (!valid) {
    return null;
  }

  await prisma.adminUser.update({
    where: { id: admin.id },
    data: { lastLoginAt: new Date() }
  });

  return admin;
}
