import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("staging configuration safety", () => {
  it("documents separate local SQLite and Railway PostgreSQL environments", () => {
    const envExample = readFileSync(path.join(root, ".env.example"), "utf8");

    expect(envExample).toContain("# LOCAL DEVELOPMENT");
    expect(envExample).toContain('APP_ENV="development"');
    expect(envExample).toContain('SQLITE_DATABASE_URL="file:./dev.db"');
    expect(envExample).toContain("# RAILWAY STAGING / PRODUCTION");
    expect(envExample).toContain("Do not set SQLITE_DATABASE_URL on Railway.");
    expect(envExample).toContain('APP_ENV="staging"');
    expect(envExample).toContain('DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/randomspin"');
    expect(envExample).toContain("UPSTASH_REDIS_REST_URL");
  });

  it("fails hosted staging or production deployments that are accidentally configured for SQLite", () => {
    const envSource = readFileSync(path.join(root, "lib/env.ts"), "utf8");

    expect(envSource).toContain('APP_ENV: appEnvSchema');
    expect(envSource).toContain("process.env.RAILWAY_ENVIRONMENT");
    expect(envSource).toContain("SQLITE_DATABASE_URL is local-development only");
    expect(envSource).toContain("Hosted staging/production requires a PostgreSQL DATABASE_URL.");
    expect(envSource).toContain("postgres(?:ql)?");
  });

  it("keeps staging and preview deployments out of search indexes", () => {
    const robots = readFileSync(path.join(root, "app/robots.ts"), "utf8");
    const layout = readFileSync(path.join(root, "app/layout.tsx"), "utf8");
    const proxy = readFileSync(path.join(root, "proxy.ts"), "utf8");
    const envSource = readFileSync(path.join(root, "lib/env.ts"), "utf8");

    expect(envSource).toContain('env.APP_ENV === "staging"');
    expect(envSource).toContain('siteHostname.endsWith(".up.railway.app")');
    expect(robots).toContain("isPublicIndexingDisabled");
    expect(robots).toContain('disallow: "/"');
    expect(robots).toContain('"/draw/"');
    expect(robots).toContain('"/players/"');
    expect(layout).toContain("index: !isPublicIndexingDisabled()");
    expect(proxy).toContain("X-Robots-Tag");
    expect(proxy).toContain("noindex, nofollow");
  });
});
