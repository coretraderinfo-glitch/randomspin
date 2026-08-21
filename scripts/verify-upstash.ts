import { randomUUID } from "node:crypto";

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
const limit = Number(process.env.SPIN_RATE_LIMIT_PER_MINUTE ?? 40);
const windowSeconds = Number(process.env.UPSTASH_VERIFY_WINDOW_SECONDS ?? 3);
const key = process.env.UPSTASH_VERIFY_KEY ?? `staging-verify-${randomUUID()}`;

if (!redisUrl || !redisToken) {
  throw new Error("UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required.");
}

if (!Number.isInteger(limit) || limit < 1) {
  throw new Error("SPIN_RATE_LIMIT_PER_MINUTE must be a positive integer.");
}

if (!Number.isInteger(windowSeconds) || windowSeconds < 1) {
  throw new Error("UPSTASH_VERIFY_WINDOW_SECONDS must be a positive integer.");
}

async function increment(keySuffix: string) {
  const safeKey = `lucky-spin:rate:${keySuffix}`;
  const response = await fetch(`${redisUrl}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${redisToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify([
      ["INCR", safeKey],
      ["EXPIRE", safeKey, String(windowSeconds), "NX"]
    ]),
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Upstash request failed with HTTP ${response.status}.`);
  }

  const results = (await response.json()) as Array<{ result?: number | string }>;
  return Number(results[0]?.result ?? limit + 1);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log(`Testing Upstash limiter with key ${key}. Credentials will not be printed.`);

  for (let request = 1; request <= limit; request += 1) {
    const count = await increment(key);
    if (count !== request || count > limit) {
      throw new Error(`Expected request ${request} to be allowed, got counter ${count}.`);
    }
  }

  console.log(`PASS requests 1-${limit} were allowed`);

  const exceeded = await increment(key);
  if (exceeded <= limit) {
    throw new Error("Expected the first request over the limit to be blocked.");
  }

  console.log("PASS limit exceeded state reached");
  await sleep((windowSeconds + 1) * 1000);

  const afterReset = await increment(key);
  if (afterReset !== 1) {
    throw new Error(`Expected counter to reset to 1, got ${afterReset}.`);
  }

  console.log("PASS reset works after the verification window");
  console.log("Run the same command with the same UPSTASH_VERIFY_KEY from two shells to confirm cross-process sharing.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
