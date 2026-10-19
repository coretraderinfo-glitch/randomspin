import { readdirSync, readFileSync, statSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function sourceFilesUnder(directory: string): string[] {
  const absoluteDirectory = path.join(root, directory);

  return readdirSync(absoluteDirectory).flatMap((entry) => {
    const absolutePath = path.join(absoluteDirectory, entry);
    const relativePath = path.join(directory, entry);
    const stats = statSync(absolutePath);

    if (stats.isDirectory()) {
      return sourceFilesUnder(relativePath);
    }

    return /\.(css|tsx?)$/.test(entry) ? [absolutePath] : [];
  });
}

describe("accessibility theme regressions", () => {
  const userFacingSource = sourceFilesUnder("app")
    .concat(sourceFilesUnder("components"))
    .map((filePath) => readFileSync(filePath, "utf8"))
    .join("\n");

  it("uses semantic readable danger styles instead of pale dark-theme danger text", () => {
    expect(userFacingSource).toContain("danger-banner");
    expect(userFacingSource).toContain("danger-control");
    expect(userFacingSource).not.toMatch(/text-rose-100|#ffd7e8|border-rose-300\/20 bg-rose-500\/10|bg-rose-500\/12/);
  });

  it("keeps focus outlines on an accessible shared focus token", () => {
    const css = readFileSync(path.join(root, "app/globals.css"), "utf8");

    expect(css).toContain("--focus: #1d4ed8");
    expect(css).toMatch(/\.focus-ring:focus-visible\s*{[^}]*outline: 3px solid var\(--focus\)/);
  });

  it("describes server authority without wheel-only wording", () => {
    const faq = readFileSync(path.join(root, "app/(public)/faq/page.tsx"), "utf8");

    expect(faq).toContain("The server determines the result independently of the visual animation.");
    expect(faq).not.toMatch(/before the wheel animation starts|before the wheel animation begins/);
  });

  it("keeps the number roller bright and avoids long false-number finishing pauses", () => {
    const css = readFileSync(path.join(root, "app/globals.css"), "utf8");
    const roller = readFileSync(path.join(root, "components/public/NumberRollerDisplay.tsx"), "utf8");
    const publicHome = readFileSync(path.join(root, "components/public/PublicHome.tsx"), "utf8");

    expect(css).toContain(".number-roller-orb");
    expect(css).toContain("radial-gradient(circle at 50% 42%, rgba(255, 255, 255, 0.98)");
    expect(css).toContain("conic-gradient(from 0deg, #06b6d4, #2563eb, #7c3aed, #14b8a6");
    expect(roller).toContain(
      'const displayValue = shuffling || phase !== "READY" ? currentNumber.toString() : "?";',
    );
    expect(publicHome).toContain("const NUMBER_ROLLER_FAST_INTERVAL_MS = 52;");
    expect(publicHome).toContain("const NUMBER_ROLLER_MIN_ACTIVE_MS = 1120;");
    expect(publicHome).toContain("const NUMBER_ROLLER_FINAL_DELAYS_MS = [100, 140, 190, 260];");
    expect(publicHome).not.toContain("[62, 72, 86, 105, 132, 170, 220, 290, 380, 500]");
  });
});
