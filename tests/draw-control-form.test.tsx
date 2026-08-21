import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DrawControlForm } from "@/components/admin/DrawControlForm";

const baseDraw = {
  id: "draw-1",
  name: "Event Draw",
  publicCode: "A7K29P",
  minNumber: 1,
  maxNumber: 30,
  excludedNumbers: [3, 9, 13, 18],
  mode: "OPERATOR" as const,
  displayStyle: "WHEEL" as const,
  pendingOperatorWinner: null,
  isActive: true
};

describe("private draw next round winner admin control", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sets a next confirmed number and refreshes after it is consumed", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ draw: { ...baseDraw, pendingOperatorWinner: 20 }, message: "Draw settings saved." }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ draw: { ...baseDraw, pendingOperatorWinner: null } }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    render(<DrawControlForm draw={baseDraw} />);

    expect(screen.getByText("Next Round Winner")).toBeInTheDocument();
    expect(screen.getByText("No next winner set")).toBeInTheDocument();

    fireEvent.change(screen.getByRole("spinbutton", { name: "Next Confirmed Number" }), { target: { value: "20" } });
    fireEvent.click(screen.getByRole("button", { name: "SET NEXT WINNER" }));

    await waitFor(() => expect(screen.getByText("Next winner set: 20")).toBeInTheDocument());
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/admin/draws/draw-1",
      expect.objectContaining({
        method: "PUT",
        body: expect.stringContaining('"nextWinner":20')
      })
    );

    fireEvent.click(screen.getByRole("button", { name: "REFRESH STATUS" }));

    await waitFor(() => expect(screen.getByText("No next winner set")).toBeInTheDocument());
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/admin/draws/draw-1");
  });

  it("disables next winner entry while the draw is random", () => {
    render(<DrawControlForm draw={{ ...baseDraw, mode: "RANDOM", pendingOperatorWinner: null }} />);

    expect(screen.getByText("Switch Draw Mode to Operator Winner before setting a confirmed number.")).toBeInTheDocument();
    expect(screen.getByRole("spinbutton", { name: "Next Confirmed Number" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "SET NEXT WINNER" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "CLEAR" })).toBeDisabled();
  });
});
