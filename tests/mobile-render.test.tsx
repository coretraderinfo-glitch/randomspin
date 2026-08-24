import React from "react";
import { readFileSync } from "fs";
import path from "path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LuckyWheel } from "@/components/public/LuckyWheel";
import { NumberRollerDisplay } from "@/components/public/NumberRollerDisplay";
import { RangeSelector } from "@/components/public/RangeSelector";
import { WinnerModal } from "@/components/public/WinnerModal";

const root = process.cwd();

describe("mobile rendering basics", () => {
  it("renders touch-friendly range controls and wheel button", () => {
    render(
      <div style={{ width: 390 }}>
        <RangeSelector label="From" value={1} onChange={vi.fn()} />
        <RangeSelector label="To" value={30} onChange={vi.fn()} />
        <LuckyWheel from={1} to={30} winner={null} rotation={0} spinning={false} onSpin={vi.fn()} />
      </div>
    );

    expect(screen.getByRole("spinbutton", { name: "From" })).toBeInTheDocument();
    expect(screen.getByRole("spinbutton", { name: "To" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "SPIN" })).toBeInTheDocument();
  });

  it("keeps the number roller and winner modal usable in compact mobile viewports", () => {
    render(
      <div style={{ width: 375 }}>
        <NumberRollerDisplay from={1} to={1000} currentNumber={1000} phase="WINNING" tempo="WINNING" spinning={false} />
        <WinnerModal
          result={{ winner: 1000, from: 1, to: 1000, timestamp: "2026-08-24T12:00:00.000Z", spinId: "spin-1" }}
          onClose={vi.fn()}
          onShare={vi.fn()}
        />
      </div>
    );

    expect(screen.getByTestId("number-roller-display")).toHaveStyle({
      maxWidth: "min(clamp(260px, 62vw, 500px), calc(100svh - 5.75rem))"
    });
    expect(screen.getByTestId("number-roller-value")).toHaveTextContent("1000");
    expect(screen.getByText((_, element) => element?.textContent === "#1000")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toHaveClass("overflow-y-auto");
    expect(screen.getByRole("button", { name: "Close result" })).toHaveClass("size-11");
  });

  it("uses 4-digit-safe number roller sizing only for 1000-style values", () => {
    const { rerender } = render(<NumberRollerDisplay from={1} to={1000} currentNumber={1000} phase="WINNING" tempo="WINNING" spinning={false} />);

    expect(screen.getByTestId("number-roller-value")).toHaveTextContent("1000");
    expect(screen.getByTestId("number-roller-value")).toHaveClass("number-roller-value-four-digit");
    expect(screen.getByTestId("number-roller-value")).toHaveClass("text-[4.25rem]");
    expect(screen.getByTestId("number-roller-value")).toHaveClass("sm:text-[5.75rem]");
    expect(screen.getByTestId("number-roller-value")).toHaveClass("lg:text-[7rem]");

    rerender(<NumberRollerDisplay from={1} to={1000} currentNumber={999} phase="WINNING" tempo="WINNING" spinning={false} />);

    expect(screen.getByTestId("number-roller-value")).toHaveTextContent("999");
    expect(screen.getByTestId("number-roller-value")).not.toHaveClass("number-roller-value-four-digit");
    expect(screen.getByTestId("number-roller-value")).toHaveClass("text-7xl");
  });

  it("uses responsive livestream layout contracts for phone, iPad, and short landscape screens", () => {
    const css = readFileSync(path.join(root, "app/globals.css"), "utf8");
    const publicHome = readFileSync(path.join(root, "components/public/PublicHome.tsx"), "utf8");
    const wheel = readFileSync(path.join(root, "components/public/LuckyWheel.tsx"), "utf8");
    const recentResults = readFileSync(path.join(root, "components/public/RecentResults.tsx"), "utf8");

    expect(css).toContain(".livestream-page-frame");
    expect(css).toContain("env(safe-area-inset-top)");
    expect(css).toContain("env(safe-area-inset-left)");
    expect(css).toContain("env(safe-area-inset-right)");
    expect(css).toContain("@media (max-height: 480px) and (orientation: landscape)");
    expect(css).toContain("overflow-x: hidden");
    expect(publicHome).toContain("livestream-hero-grid");
    expect(publicHome).toContain("md:row-span-2");
    expect(publicHome).toContain("min-h-11");
    expect(publicHome).toContain("sm:min-w-[11rem]");
    expect(wheel).toContain("calc(100svh - 5.75rem)");
    expect(wheel).toContain("sm:size-[108px]");
    expect(recentResults).toContain("max-h-[7.75rem]");
  });

  it("keeps admin live control touch targets and navigation mobile-friendly", () => {
    const adminShell = readFileSync(path.join(root, "components/admin/AdminShell.tsx"), "utf8");
    const drawControl = readFileSync(path.join(root, "components/admin/DrawControlForm.tsx"), "utf8");
    const gameNav = readFileSync(path.join(root, "components/public/PublicGameNav.tsx"), "utf8");

    expect(adminShell).toContain("grid-cols-2");
    expect(adminShell).toContain("lg:grid-cols-1");
    expect(adminShell).toContain("min-w-0");
    expect(drawControl).toContain("Live Next Winner");
    expect(drawControl).toContain("min-h-12");
    expect(drawControl).toContain("h-11 rounded-lg border text-sm font-black");
    expect(drawControl).toContain("grid gap-2 sm:flex sm:flex-wrap");
    expect(gameNav).toContain("min-h-11");
  });
});
