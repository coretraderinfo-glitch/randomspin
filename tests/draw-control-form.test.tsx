import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DrawControlForm } from "@/components/admin/DrawControlForm";

const baseDraw = {
  id: "draw-1",
  name: "Event Draw",
  publicCode: "A7K29P",
  liveSlug: null,
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
        new Response(JSON.stringify({ draw: { ...baseDraw, pendingOperatorWinner: 20 }, message: "" }), {
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
    expect(screen.getByText("Next Winner: Not set")).toBeInTheDocument();
    expect(screen.getByText("Next spin will be random.")).toBeInTheDocument();

    fireEvent.change(screen.getByRole("spinbutton", { name: "Next Confirmed Number" }), { target: { value: "20" } });
    fireEvent.click(screen.getByRole("button", { name: "SET NEXT WINNER" }));

    await waitFor(() => expect(screen.getByText("Next winner set successfully.")).toBeInTheDocument());
    expect(screen.getByText("Next Winner: Set")).toBeInTheDocument();
    expect(screen.getByText("Next spin will use the confirmed number once. Confirmed number: 20")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/admin/draws/draw-1",
      expect.objectContaining({
        method: "PUT",
        body: expect.stringContaining('"nextWinner":20')
      })
    );

    fireEvent.click(screen.getByRole("button", { name: "REFRESH STATUS" }));

    await waitFor(() => expect(screen.getByText("Next Winner: Not set")).toBeInTheDocument());
    expect(screen.getByText("Next spin will be random.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/admin/draws/draw-1");
  });

  it("saves inactive starting range changes with a clear success message and no empty banner", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ draw: { ...baseDraw, isActive: false, maxNumber: 66 }, message: "" }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        })
      )
    );

    const { container } = render(<DrawControlForm draw={{ ...baseDraw, isActive: false }} />);

    fireEvent.change(screen.getByRole("spinbutton", { name: "To" }), { target: { value: "66" } });
    fireEvent.click(screen.getByRole("button", { name: "SAVE CHANGES" }));

    await waitFor(() => expect(screen.getByText("Draw settings saved.")).toBeInTheDocument());
    expect(container.querySelector(".success-banner")?.textContent).toBe("Draw settings saved.");
  });

  it("locks active backend range fields and omits stale range values from normal saves", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ draw: { ...baseDraw, maxNumber: 19 }, message: "Draw settings saved." }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<DrawControlForm draw={{ ...baseDraw, maxNumber: 19 }} />);

    expect(screen.getByRole("spinbutton", { name: "From" })).toHaveAttribute("readonly");
    expect(screen.getByRole("spinbutton", { name: "To" })).toHaveAttribute("readonly");
    expect(screen.getByText("Live range: 1–19")).toBeInTheDocument();
    expect(screen.getByText("Range is currently controlled from the live draw page.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Excluded Numbers"), { target: { value: "3,9,14" } });
    fireEvent.click(screen.getByRole("button", { name: "SAVE CHANGES" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body ?? "{}"));
    expect(body).not.toHaveProperty("minNumber");
    expect(body).not.toHaveProperty("maxNumber");
    expect(body.excludedText).toBe("3,9,14");
  });

  it("provides compact live control for arming and clearing the next winner", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ draw: { ...baseDraw, pendingOperatorWinner: 15 }, message: "" }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ draw: { ...baseDraw, pendingOperatorWinner: null }, message: "" }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    render(<DrawControlForm draw={baseDraw} />);

    expect(screen.getByText("Live Control")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Random ready");
    expect(screen.getByRole("status")).not.toHaveAttribute("aria-label");

    fireEvent.change(screen.getByRole("spinbutton", { name: "Live Next Winner" }), { target: { value: "15" } });
    fireEvent.click(screen.getByRole("button", { name: "SET NEXT" }));

    await waitFor(() => expect(screen.getByText("Next winner armed")).toBeInTheDocument());
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/admin/draws/draw-1",
      expect.objectContaining({
        method: "PUT",
        body: expect.stringContaining('"nextWinner":15')
      })
    );

    fireEvent.click(screen.getByRole("button", { name: "CLEAR NEXT" }));

    await waitFor(() => expect(screen.getByText("Next winner cleared")).toBeInTheDocument());
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/admin/draws/draw-1",
      expect.objectContaining({
        method: "PUT",
        body: expect.stringContaining('"nextWinner":null')
      })
    );
  });

  it("provides quick exclusion toggle, undo, and two-step clear controls", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ draw: { ...baseDraw, excludedNumbers: [3, 8, 9, 13, 18] }, message: "" }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ draw: { ...baseDraw, excludedNumbers: [3, 9, 13, 18] }, message: "Last exclusion change undone." }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ draw: { ...baseDraw, excludedNumbers: [] }, message: "" }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    render(<DrawControlForm draw={baseDraw} />);

    fireEvent.click(screen.getAllByRole("button", { name: "8" })[0]);
    await waitFor(() => expect(screen.getByText("Exclusions updated")).toBeInTheDocument());
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body ?? "{}")).excludedText).toBe("3,8,9,13,18");

    fireEvent.click(screen.getByRole("button", { name: "UNDO LAST" }));
    await waitFor(() => expect(screen.getByText("Last exclusion undone")).toBeInTheDocument());
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/admin/draws/draw-1",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ action: "undo-exclusion" }) })
    );

    fireEvent.click(screen.getByRole("button", { name: "CLEAR EXCLUSIONS" }));
    expect(screen.getByRole("button", { name: "CONFIRM CLEAR" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByRole("button", { name: "CONFIRM CLEAR" }));
    await waitFor(() => expect(screen.getByText("Exclusions cleared")).toBeInTheDocument());
    expect(JSON.parse(String(fetchMock.mock.calls[2][1]?.body ?? "{}")).excludedText).toBe("");
  });

  it("does not re-submit stale next-winner text when updating exclusions", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ draw: { ...baseDraw, pendingOperatorWinner: null, excludedNumbers: [3, 8, 9, 13, 18] }, message: "" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<DrawControlForm draw={{ ...baseDraw, pendingOperatorWinner: 7 }} />);
    fireEvent.change(screen.getByRole("spinbutton", { name: "Live Next Winner" }), { target: { value: "7" } });
    fireEvent.click(screen.getAllByRole("button", { name: "8" })[0]);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body ?? "{}"));
    expect(body).not.toHaveProperty("nextWinner");
    expect(body).not.toHaveProperty("action");
    await waitFor(() => expect(screen.getByText("Next Winner: Not set")).toBeInTheDocument());
    expect(screen.getByRole("spinbutton", { name: "Live Next Winner" })).toHaveValue(null);
  });

  it("clears a next winner with a clear success message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ draw: { ...baseDraw, pendingOperatorWinner: null }, message: "" }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        })
      )
    );

    render(<DrawControlForm draw={{ ...baseDraw, pendingOperatorWinner: 20 }} />);

    fireEvent.click(screen.getByRole("button", { name: "CLEAR" }));

    await waitFor(() => expect(screen.getByText("Next winner cleared.")).toBeInTheDocument());
    expect(screen.getByText("Next Winner: Not set")).toBeInTheDocument();
  });

  it("disables save while a request is pending", async () => {
    let resolveResponse: (response: Response) => void = () => {};
    vi.stubGlobal(
      "fetch",
      vi.fn().mockReturnValue(
        new Promise<Response>((resolve) => {
          resolveResponse = resolve;
        })
      )
    );

    render(<DrawControlForm draw={baseDraw} />);

    fireEvent.click(screen.getByRole("button", { name: "SAVE CHANGES" }));

    expect(screen.getByRole("button", { name: "Saving..." })).toBeDisabled();
    expect(screen.getByRole("button", { name: "SET NEXT WINNER" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "CLEAR" })).toBeDisabled();

    resolveResponse(
      new Response(JSON.stringify({ draw: baseDraw, message: "Draw settings saved." }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByRole("button", { name: "SAVE CHANGES" })).not.toBeDisabled();
  });

  it("disables next winner entry while the draw is random", () => {
    render(<DrawControlForm draw={{ ...baseDraw, mode: "RANDOM", pendingOperatorWinner: null }} />);

    expect(screen.getByRole("status")).toHaveTextContent("Random ready");
    expect(screen.getByText("Switch Draw Mode to Operator Winner before setting a confirmed number.")).toBeInTheDocument();
    expect(screen.getByRole("spinbutton", { name: "Next Confirmed Number" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "SET NEXT WINNER" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "CLEAR" })).toBeDisabled();
  });

  it("persists operator mode and keeps next-winner controls enabled after a refreshed live range", async () => {
    const operatorDraw = { ...baseDraw, mode: "OPERATOR" as const, pendingOperatorWinner: null };
    const armedDraw = { ...operatorDraw, pendingOperatorWinner: 20 };
    const refreshedDraw = { ...armedDraw, maxNumber: 40 };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ draw: operatorDraw, message: "Draw settings saved." }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ draw: armedDraw, message: "" }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ draw: refreshedDraw }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    render(<DrawControlForm draw={{ ...baseDraw, mode: "RANDOM", pendingOperatorWinner: null }} />);

    const nextWinnerInput = screen.getByRole("spinbutton", { name: "Next Confirmed Number" });
    expect(nextWinnerInput).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Draw Mode"), { target: { value: "OPERATOR" } });
    expect(nextWinnerInput).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "SAVE CHANGES" }));
    await waitFor(() => expect(screen.getByText("Draw settings saved.")).toBeInTheDocument());
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body ?? "{}"))).toEqual(
      expect.objectContaining({ mode: "OPERATOR" })
    );
    expect(nextWinnerInput).toBeEnabled();

    fireEvent.change(nextWinnerInput, { target: { value: "20" } });
    fireEvent.click(screen.getByRole("button", { name: "SET NEXT WINNER" }));
    await waitFor(() => expect(screen.getByText("Next winner set successfully.")).toBeInTheDocument());
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body ?? "{}"))).toEqual(
      expect.objectContaining({ mode: "OPERATOR", action: "set", nextWinner: 20 })
    );

    fireEvent.click(screen.getByRole("button", { name: "REFRESH STATUS" }));
    await waitFor(() => expect(screen.getByText("Next Winner: Set")).toBeInTheDocument());
    expect(screen.getByText("Live range: 1–40")).toBeInTheDocument();
    expect(nextWinnerInput).toBeEnabled();
  });
});
