import "server-only";
import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import QRCode from "qrcode";
import { getAdminTotpEncryptionKey, getSiteUrl } from "@/lib/env";

const base32Alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const totpDigits = 6;
const totpPeriodSeconds = 30;
const totpAllowedDrift = 1;

function getEncryptionKey() {
  const raw = getAdminTotpEncryptionKey();
  const decoded = /^[a-f0-9]{64}$/i.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");

  if (decoded.length !== 32) {
    throw new Error("ADMIN_TOTP_ENCRYPTION_KEY must be a 32-byte base64 or hex value.");
  }

  return decoded;
}

export function generateTotpSecret() {
  return base32Encode(randomBytes(20));
}

export function base32Encode(input: Buffer) {
  let bits = "";
  let output = "";

  for (const byte of input) {
    bits += byte.toString(2).padStart(8, "0");
  }

  for (let index = 0; index < bits.length; index += 5) {
    const chunk = bits.slice(index, index + 5).padEnd(5, "0");
    output += base32Alphabet[Number.parseInt(chunk, 2)];
  }

  return output;
}

export function base32Decode(input: string) {
  const normalized = input.replace(/[\s=]/g, "").toUpperCase();
  let bits = "";

  for (const char of normalized) {
    const value = base32Alphabet.indexOf(char);
    if (value === -1) {
      throw new Error("Invalid TOTP secret.");
    }
    bits += value.toString(2).padStart(5, "0");
  }

  const bytes: number[] = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  }

  return Buffer.from(bytes);
}

export function getTotpStep(now = Date.now()) {
  return Math.floor(now / 1000 / totpPeriodSeconds);
}

export function generateTotpCode(secret: string, step = getTotpStep()) {
  const secretBuffer = base32Decode(secret);
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));

  const hmac = createHmac("sha1", secretBuffer).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  return (binary % 10 ** totpDigits).toString().padStart(totpDigits, "0");
}

function safeCodeEquals(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function verifyTotpCode(secret: string, code: string, options: { now?: number; lastUsedStep?: number | null } = {}) {
  const normalizedCode = code.trim();
  if (!/^\d{6}$/.test(normalizedCode)) {
    return null;
  }

  const currentStep = getTotpStep(options.now);
  for (let offset = -totpAllowedDrift; offset <= totpAllowedDrift; offset += 1) {
    const step = currentStep + offset;
    if (options.lastUsedStep !== null && options.lastUsedStep !== undefined && step <= options.lastUsedStep) {
      continue;
    }

    if (safeCodeEquals(generateTotpCode(secret, step), normalizedCode)) {
      return { step };
    }
  }

  return null;
}

export function encryptTotpSecret(secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${ciphertext.toString("base64url")}`;
}

export function decryptTotpSecret(encrypted: string) {
  const [version, iv, tag, ciphertext] = encrypted.split(".");
  if (version !== "v1" || !iv || !tag || !ciphertext) {
    throw new Error("Invalid encrypted TOTP secret.");
  }

  const decipher = createDecipheriv("aes-256-gcm", getEncryptionKey(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8");
}

export function createTotpOtpAuthUrl({ email, secret }: { email: string; secret: string }) {
  const issuer = "RandomSpin";
  const label = `${issuer}:${email}`;
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: totpDigits.toString(),
    period: totpPeriodSeconds.toString()
  });

  return `otpauth://totp/${encodeURIComponent(label)}?${params.toString()}`;
}

export async function createTotpQrDataUrl({ email, secret }: { email: string; secret: string }) {
  const url = createTotpOtpAuthUrl({ email, secret });
  return QRCode.toDataURL(url, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 240
  });
}

export function getTotpIssuerOrigin() {
  return new URL(getSiteUrl()).origin;
}
