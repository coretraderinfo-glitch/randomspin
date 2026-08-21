import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LuckyWheel } from "@/components/public/LuckyWheel";
import { RangeSelector } from "@/components/public/RangeSelector";

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
});
