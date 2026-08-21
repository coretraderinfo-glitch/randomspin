import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LuckyPlayerHome } from "@/components/public/LuckyPlayerHome";

describe("RandomSpin Player Draw public experience", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn()
      }))
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  async function finishDraw() {
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(7000);
    });
  }

  function successfulPlayerResponse(displayName: string, participantId = displayName.toLowerCase()) {
    return new Response(
      JSON.stringify({
        spinId: `player-spin-${participantId}`,
        participantId,
        displayName,
        reference: "002",
        eligibleCount: 5,
        timestamp: "2026-08-21T01:02:03.000Z"
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  it("renders as a separate Player Draw game with navigation and no number wheel", () => {
    render(<LuckyPlayerHome />);

    expect(screen.getByRole("link", { name: "Number Draw" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Player Draw" })).toHaveAttribute("aria-current", "page");
    expect(screen.getAllByText("Player Draw").length).toBeGreaterThan(0);
    expect(screen.getByText("Name Roller")).toBeInTheDocument();
    expect(screen.queryByLabelText("RandomSpin number wheel")).not.toBeInTheDocument();
    expect(screen.queryByRole("spinbutton", { name: "From" })).not.toBeInTheDocument();
  });

  it("displays the stronger player ready counter", () => {
    render(<LuckyPlayerHome />);

    expect(screen.getByText("5 PLAYERS READY")).toBeInTheDocument();
    expect(screen.getByText("5 Eligible")).toBeInTheDocument();
  });

  it("shuffle only changes presentation and does not call the winner API", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<LuckyPlayerHome />);
    fireEvent.click(screen.getByRole("button", { name: "SHUFFLE" }));

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("draw player uses the server result and then says DRAW AGAIN", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successfulPlayerResponse("Sarah", "sarah"));
    vi.stubGlobal("fetch", fetchMock);

    render(<LuckyPlayerHome />);
    fireEvent.click(screen.getByRole("button", { name: "DRAW PLAYER" }));
    await finishDraw();

    expect(fetchMock).toHaveBeenCalledWith("/api/player-spin", expect.objectContaining({ method: "POST" }));
    expect(screen.getAllByText("WINNING PLAYER").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Sarah").length).toBeGreaterThan(0);
    expect(screen.getByText("Recent Winners")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "DRAW AGAIN" })).toBeInTheDocument();
  });

  it("DRAW PLAYER begins a visual countdown while the API request starts immediately", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successfulPlayerResponse("Sarah", "sarah"));
    vi.stubGlobal("fetch", fetchMock);

    render(<LuckyPlayerHome />);
    fireEvent.click(screen.getByRole("button", { name: "DRAW PLAYER" }));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByText("GET READY")).toBeInTheDocument();
    expect(screen.getByText("COUNTDOWN")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.queryByText("WINNING PLAYER")).not.toBeInTheDocument();
  });

  it("does not show a fake frontend winner before the server result resolves", async () => {
    let resolveFetch: (response: Response) => void = () => {};
    const fetchMock = vi.fn().mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<LuckyPlayerHome />);
    fireEvent.click(screen.getByRole("button", { name: "DRAW PLAYER" }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2200);
    });

    expect(screen.getByText("ROLLING...")).toBeInTheDocument();
    expect(screen.queryByText("WINNING PLAYER")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    resolveFetch(successfulPlayerResponse("Jason", "jason"));
    await finishDraw();

    expect(screen.getAllByText("WINNING PLAYER").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Jason").length).toBeGreaterThan(0);
  });

  it("uses short final decorative timings and avoids long near-miss pauses", async () => {
    const timeoutSpy = vi.spyOn(window, "setTimeout");
    const fetchMock = vi.fn().mockResolvedValue(successfulPlayerResponse("Jason", "jason"));
    vi.stubGlobal("fetch", fetchMock);

    render(<LuckyPlayerHome />);
    fireEvent.click(screen.getByRole("button", { name: "DRAW PLAYER" }));
    await finishDraw();

    const delays = timeoutSpy.mock.calls.map((call) => call[1]);
    expect(delays).toEqual(expect.arrayContaining([100, 140, 190, 260, 1200]));
    expect(delays).not.toContain(470);
    expect(delays).not.toContain(620);
    expect(screen.getAllByText("Jason").length).toBeGreaterThan(0);
  });

  it("changes final status to WINNING PLAYER only when the server winner is reached", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successfulPlayerResponse("Wendy", "wendy"));
    vi.stubGlobal("fetch", fetchMock);

    render(<LuckyPlayerHome />);
    fireEvent.click(screen.getByRole("button", { name: "DRAW PLAYER" }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(screen.getByText("COUNTDOWN")).toBeInTheDocument();
    expect(screen.queryByText("WINNING PLAYER")).not.toBeInTheDocument();

    await finishDraw();

    expect(screen.getAllByText("WINNING PLAYER").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Wendy").length).toBeGreaterThan(0);
  });

  it("API failure stops rolling without showing a winner", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "No draw." }), { status: 500, headers: { "Content-Type": "application/json" } })
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<LuckyPlayerHome />);
    fireEvent.click(screen.getByRole("button", { name: "DRAW PLAYER" }));

    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(screen.queryByText("WINNING PLAYER")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText("Unable to complete this player draw. Please try again.")).toBeInTheDocument();
  });

  it("private player audience shows mode badge without exposing pending winner controls", () => {
    render(
      <LuckyPlayerHome
        initialParticipants={[
          { id: "ali", displayName: "Ali", reference: "001", isEligible: true },
          { id: "sarah", displayName: "Sarah", reference: "002", isEligible: true }
        ]}
        mode={{
          kind: "private",
          publicCode: "PLAYTEST",
          spinEndpoint: "/api/player-draw/PLAYTEST/spin",
          label: "OPERATOR DRAW",
          eventName: "Local RandomSpin Player Test",
          participantCount: 2,
          eligibleCount: 2,
          removeWinnerAfterWin: false,
          showParticipantList: true
        }}
      />
    );

    expect(screen.getByText("OPERATOR DRAW")).toBeInTheDocument();
    expect(screen.getByText("Local RandomSpin Player Test")).toBeInTheDocument();
    expect(screen.queryByText(/Next Winner/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Admin/i)).not.toBeInTheDocument();
    expect(screen.queryByText("sarah")).not.toBeInTheDocument();
  });

  it("private recent winners stay hidden when the private setting is off", () => {
    render(
      <LuckyPlayerHome
        initialParticipants={[{ id: "ali", displayName: "Ali", reference: "001", isEligible: true }]}
        mode={{
          kind: "private",
          publicCode: "PLAYTEST",
          spinEndpoint: "/api/player-draw/PLAYTEST/spin",
          label: "RANDOM DRAW",
          eventName: "Local RandomSpin Player Test",
          participantCount: 1,
          eligibleCount: 1,
          removeWinnerAfterWin: false,
          showParticipantList: false
        }}
      />
    );

    expect(screen.queryByText("Recent Winners")).not.toBeInTheDocument();
    expect(screen.getByText("Participant list is hidden for this event.")).toBeInTheDocument();
    expect(screen.queryByText("ali")).not.toBeInTheDocument();
  });

  it("Live Mode hides editor controls and Exit Live Mode restores them", () => {
    render(<LuckyPlayerHome />);

    expect(screen.getByText("Paste Names")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Add player name")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "LIVE MODE" }));

    expect(screen.queryByText("Paste Names")).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Add player name")).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Search")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "EXIT LIVE MODE" }));

    expect(screen.getByText("Paste Names")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Add player name")).toBeInTheDocument();
  });

  it("buttons are disabled during active draw and restored after failure", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "No draw." }), { status: 500, headers: { "Content-Type": "application/json" } })
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<LuckyPlayerHome />);
    fireEvent.click(screen.getByRole("button", { name: "DRAW PLAYER" }));

    expect(screen.getByRole("button", { name: "DRAWING" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "SHUFFLE" })).toBeDisabled();

    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(screen.getByRole("button", { name: "DRAW PLAYER" })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "SHUFFLE" })).not.toBeDisabled();
  });

  it("private Random label remains unchanged", () => {
    render(
      <LuckyPlayerHome
        initialParticipants={[{ id: "ali", displayName: "Ali", reference: "001", isEligible: true }]}
        mode={{
          kind: "private",
          publicCode: "PLAYTEST",
          spinEndpoint: "/api/player-draw/PLAYTEST/spin",
          label: "RANDOM DRAW",
          eventName: "Local RandomSpin Player Test",
          participantCount: 1,
          eligibleCount: 1,
          removeWinnerAfterWin: false,
          showParticipantList: true
        }}
      />
    );

    expect(screen.getByText("RANDOM DRAW")).toBeInTheDocument();
    expect(screen.queryByText("OPERATOR DRAW")).not.toBeInTheDocument();
  });

  it("operator audience uses the same server-returned winner ending without exposing the pending participant early", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successfulPlayerResponse("Sarah", "sarah"));
    vi.stubGlobal("fetch", fetchMock);

    render(
      <LuckyPlayerHome
        initialParticipants={[
          { id: "public-1", displayName: "Ali", reference: "001", isEligible: true },
          { id: "public-2", displayName: "Sarah", reference: "002", isEligible: true },
          { id: "public-3", displayName: "David", reference: "003", isEligible: true }
        ]}
        mode={{
          kind: "private",
          publicCode: "PLAYTEST",
          spinEndpoint: "/api/player-draw/PLAYTEST/spin",
          label: "OPERATOR DRAW",
          eventName: "Local RandomSpin Player Test",
          participantCount: 3,
          eligibleCount: 3,
          removeWinnerAfterWin: false,
          showParticipantList: true
        }}
      />
    );

    expect(screen.queryByText("WINNING PLAYER")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "DRAW PLAYER" }));
    await finishDraw();

    expect(fetchMock).toHaveBeenCalledWith("/api/player-draw/PLAYTEST/spin", expect.objectContaining({ method: "POST" }));
    expect(screen.getAllByText("WINNING PLAYER").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Sarah").length).toBeGreaterThan(0);
  });

  it("shows references for duplicate names when references are available", () => {
    render(
      <LuckyPlayerHome
        initialParticipants={[
          { id: "public-1", displayName: "James Lee", reference: "001", isEligible: true },
          { id: "public-2", displayName: "James Lee", reference: "032", isEligible: true },
          { id: "public-3", displayName: "James Lee", reference: "048", isEligible: true }
        ]}
      />
    );

    expect(screen.getAllByText("James Lee").length).toBeGreaterThan(0);
    expect(screen.getByText("Reference: 001")).toBeInTheDocument();
    expect(screen.getByText("Reference: 032")).toBeInTheDocument();
    expect(screen.getByText("Reference: 048")).toBeInTheDocument();
  });

  it("adds UI-only duplicate numbering when duplicate names have no reference", () => {
    render(
      <LuckyPlayerHome
        initialParticipants={[
          { id: "public-1", displayName: "James Lee", reference: null, isEligible: true },
          { id: "public-2", displayName: "James Lee", reference: null, isEligible: true }
        ]}
      />
    );

    expect(screen.getByText("· #1")).toBeInTheDocument();
    expect(screen.getByText("· #2")).toBeInTheDocument();
  });
});
