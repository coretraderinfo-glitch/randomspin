import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LuckyPlayerHome } from "@/components/public/LuckyPlayerHome";
import type { PlayerParticipantView } from "@/components/public/LuckyPlayerHome";

describe("RandomSpin Player Draw public experience", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.sessionStorage.clear();
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
        dispatchEvent: vi.fn(),
      })),
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

  function successfulPlayerResponse(
    displayName: string,
    participantId = displayName.toLowerCase(),
  ) {
    return new Response(
      JSON.stringify({
        spinId: `player-spin-${participantId}`,
        participantId,
        displayName,
        reference: "002",
        eligibleCount: 5,
        timestamp: "2026-08-21T01:02:03.000Z",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  const drawParticipants: PlayerParticipantView[] = [
    {
      id: "player-1",
      displayName: "Alice",
      reference: "001",
      isEligible: true,
    },
    { id: "player-2", displayName: "Ben", reference: "002", isEligible: true },
    {
      id: "player-3",
      displayName: "Chloe",
      reference: "003",
      isEligible: true,
    },
    { id: "player-4", displayName: "Dina", reference: "004", isEligible: true },
    { id: "player-5", displayName: "Evan", reference: "005", isEligible: true },
  ];

  function renderWithPlayers(participants = drawParticipants) {
    return render(<LuckyPlayerHome initialParticipants={participants} />);
  }

  function startLiveDraw() {
    fireEvent.click(screen.getByRole("button", { name: "LIVE DRAW" }));
  }

  it("renders as a separate Player Draw game with navigation and no number wheel", () => {
    render(<LuckyPlayerHome />);

    expect(screen.getByRole("link", { name: "Number Draw" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.getByRole("link", { name: "Player Draw" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getAllByText("Player Draw").length).toBeGreaterThan(0);
    expect(screen.getByText("Name Roller")).toBeInTheDocument();
    expect(
      screen.queryByLabelText("RandomSpin number wheel"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("spinbutton", { name: "From" }),
    ).not.toBeInTheDocument();
  });

  it("displays the stronger player ready counter", () => {
    render(<LuckyPlayerHome />);

    expect(screen.getByText("Player Setup")).toBeInTheDocument();
    expect(screen.getByText("0 PLAYERS READY")).toBeInTheDocument();
    expect(screen.getByText("0 Eligible")).toBeInTheDocument();
    expect(
      screen.getByText("Paste names, import a CSV, or add players manually."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "LIVE DRAW" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Shuffle participants, count 0" }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "Add participant" })).toHaveClass(
      "h-12",
      "min-w-12",
    );
    expect(screen.queryByLabelText("Import CSV")).not.toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText("Reference (optional)"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "MORE OPTIONS" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Recent Winners")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "DRAW PLAYER" }),
    ).not.toBeInTheDocument();
  });

  it("does not preload demo players on the production public page", () => {
    render(<LuckyPlayerHome />);

    expect(
      screen.getByPlaceholderText("Paste one player per line"),
    ).toHaveValue("");
    for (const sampleName of ["Ali", "Jason", "Sarah", "David", "Wendy"]) {
      expect(screen.queryByText(sampleName)).not.toBeInTheDocument();
    }
  });

  it("loads pasted names only after the user confirms using pasted names", () => {
    render(<LuckyPlayerHome />);

    const pasteBox = screen.getByPlaceholderText("Paste one player per line");
    fireEvent.change(pasteBox, { target: { value: "Alice\nBob\nCharlie" } });

    expect(screen.getByText("0 PLAYERS READY")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "USE NAMES" }));

    expect(screen.getByText("3 PLAYERS READY")).toBeInTheDocument();
    expect(screen.getByText("3 Eligible")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("Charlie")).toBeInTheDocument();
    expect(screen.queryByText("Jason")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Participant list updated."),
    ).not.toBeInTheDocument();
  });

  it("Clear List requires confirmation and clears silently", () => {
    const { unmount } = render(<LuckyPlayerHome />);

    const pasteBox = screen.getByPlaceholderText("Paste one player per line");
    fireEvent.change(pasteBox, { target: { value: "Alice\nBob\nCharlie" } });
    fireEvent.click(screen.getByRole("button", { name: "USE NAMES" }));
    fireEvent.change(screen.getByPlaceholderText("Add player name"), {
      target: { value: "Dana" },
    });
    fireEvent.click(screen.getByRole("button", { name: "MORE OPTIONS" }));
    fireEvent.change(screen.getByPlaceholderText("Reference (optional)"), {
      target: { value: "009" },
    });
    fireEvent.change(screen.getByPlaceholderText("Search"), {
      target: { value: "Alice" },
    });

    fireEvent.click(screen.getByRole("button", { name: "CLEAR LIST" }));

    expect(
      screen.getByRole("button", { name: "CONFIRM CLEAR" }),
    ).toBeInTheDocument();
    expect(screen.getByText("3 PLAYERS READY")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "CONFIRM CLEAR" }));

    expect(screen.getByText("0 PLAYERS READY")).toBeInTheDocument();
    expect(screen.getByText("0 Eligible")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Paste one player per line"),
    ).toHaveValue("");
    expect(screen.getByPlaceholderText("Add player name")).toHaveValue("");
    expect(
      screen.queryByPlaceholderText("Reference (optional)"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "MORE OPTIONS" }),
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Search")).toHaveValue("");
    expect(screen.queryByText("Alice")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "CLEAR LIST" })).toBeDisabled();
    expect(screen.queryByText("Player list cleared.")).not.toBeInTheDocument();

    unmount();
    render(<LuckyPlayerHome />);
    expect(screen.getByText("0 PLAYERS READY")).toBeInTheDocument();
    expect(screen.queryByText("Alice")).not.toBeInTheDocument();
  });

  it("Clear List confirmation auto-resets when not confirmed", async () => {
    renderWithPlayers();

    fireEvent.click(screen.getByRole("button", { name: "CLEAR LIST" }));
    expect(
      screen.getByRole("button", { name: "CONFIRM CLEAR" }),
    ).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3500);
    });

    expect(
      screen.getByRole("button", { name: "CLEAR LIST" }),
    ).toBeInTheDocument();
    expect(screen.getByText("5 PLAYERS READY")).toBeInTheDocument();
  });

  it("manual add still creates a distinct player with an optional reference", () => {
    render(<LuckyPlayerHome />);

    fireEvent.change(screen.getByPlaceholderText("Add player name"), {
      target: { value: "Mina Park" },
    });
    expect(
      screen.queryByPlaceholderText("Reference (optional)"),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "MORE OPTIONS" }));
    fireEvent.change(screen.getByPlaceholderText("Reference (optional)"), {
      target: { value: "VIP-7" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add participant" }));

    expect(screen.getByText("1 PLAYERS READY")).toBeInTheDocument();
    expect(screen.getByText("Mina Park")).toBeInTheDocument();
    expect(screen.getByText("Reference: VIP-7")).toBeInTheDocument();
  });

  it("CSV import still creates players without sample data", async () => {
    render(<LuckyPlayerHome />);

    expect(screen.queryByLabelText("Import CSV")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "MORE OPTIONS" }));

    const file = {
      name: "players.csv",
      size: 32,
      text: vi.fn().mockResolvedValue("Name,Reference\nRina,101\nLeo,102"),
    } as unknown as File;
    fireEvent.change(screen.getByLabelText("Import CSV"), {
      target: { files: [file] },
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText("2 PLAYERS READY")).toBeInTheDocument();
    expect(screen.getByText("Rina")).toBeInTheDocument();
    expect(screen.getByText("Reference: 101")).toBeInTheDocument();
    expect(screen.getByText("Leo")).toBeInTheDocument();
    expect(screen.queryByText("Wendy")).not.toBeInTheDocument();
    expect(
      screen.queryByText("CSV participants imported."),
    ).not.toBeInTheDocument();
  });

  it("Draw Player is not available until Setup Mode has eligible players and LIVE DRAW starts", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<LuckyPlayerHome />);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "LIVE DRAW" })).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: "DRAW PLAYER" }),
    ).not.toBeInTheDocument();
  });

  it("setup Shuffle changes visible order only and does not call the winner API", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(Math, "random").mockReturnValue(0);

    renderWithPlayers([
      {
        id: "player-1",
        displayName: "Alice",
        reference: "001",
        isEligible: true,
      },
      {
        id: "player-2",
        displayName: "Ben",
        reference: "002",
        isEligible: true,
      },
      {
        id: "player-3",
        displayName: "Chloe",
        reference: "003",
        isEligible: true,
      },
    ]);
    const before = screen
      .getAllByText(/Alice|Ben|Chloe/)
      .map((node) => node.textContent);
    fireEvent.click(
      screen.getByRole("button", { name: "Shuffle participants, count 0" }),
    );
    const after = screen
      .getAllByText(/Alice|Ben|Chloe/)
      .map((node) => node.textContent);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(after).not.toEqual(before);
    expect(after.sort()).toEqual(before.sort());
    expect(screen.getByText("3 PLAYERS READY")).toBeInTheDocument();
    expect(screen.getByText("3 Eligible")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Shuffle participants, count 1" }),
    ).toHaveTextContent("SHUFFLE 1×");
  });

  it("resets the player shuffle count when participant membership changes", () => {
    renderWithPlayers();
    fireEvent.click(
      screen.getByRole("button", { name: "Shuffle participants, count 0" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Remove Alice" }));

    expect(
      screen.getByRole("button", { name: "Shuffle participants, count 0" }),
    ).toBeInTheDocument();
  });

  it("resets the completed player draw shuffle state for the next draw and session", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(successfulPlayerResponse("Sarah", "sarah"));
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(Math, "random")
      .mockReturnValueOnce(0.9)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.9)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.9)
      .mockReturnValueOnce(0);
    const players = drawParticipants.slice(0, 3);
    const first = renderWithPlayers(players);

    for (let count = 0; count < 3; count += 1) {
      fireEvent.click(
        screen.getByRole("button", {
          name: `Shuffle participants, count ${count}`,
        }),
      );
    }
    expect(
      screen.getAllByRole("button", { name: /Remove (Alice|Ben|Chloe)/ })
        .map((button) => button.getAttribute("aria-label")),
    ).toEqual(["Remove Ben", "Remove Alice", "Remove Chloe"]);

    startLiveDraw();
    expect(
      screen.getByRole("button", { name: "Shuffle participants, count 3" }),
    ).toBeDisabled();

    await finishDraw();

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Shuffle participants, count 0" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close player result" }));
    fireEvent.click(screen.getByRole("button", { name: "EDIT PLAYERS" }));
    expect(
      screen.getAllByRole("button", { name: /Remove (Alice|Ben|Chloe)/ })
        .map((button) => button.getAttribute("aria-label")),
    ).toEqual(["Remove Alice", "Remove Ben", "Remove Chloe"]);

    first.unmount();
    renderWithPlayers(players);
    expect(
      screen.getByRole("button", { name: "Shuffle participants, count 0" }),
    ).toBeInTheDocument();
  });

  it("preserves player shuffle state when the draw fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "No draw." }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    vi.spyOn(Math, "random").mockReturnValue(0);
    renderWithPlayers(drawParticipants.slice(0, 3));

    for (let count = 0; count < 3; count += 1) {
      fireEvent.click(
        screen.getByRole("button", {
          name: `Shuffle participants, count ${count}`,
        }),
      );
    }

    startLiveDraw();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(
      screen.getByRole("button", { name: "Shuffle participants, count 3" }),
    ).toBeInTheDocument();
  });

  it("live Shuffle remains presentation-only and does not call the winner API between draws", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(successfulPlayerResponse("Sarah", "sarah"));
    vi.stubGlobal("fetch", fetchMock);

    renderWithPlayers();
    startLiveDraw();
    await finishDraw();
    fireEvent.click(
      screen.getByRole("button", { name: "Close player result" }),
    );
    fetchMock.mockClear();

    fireEvent.click(
      screen.getByRole("button", { name: "Shuffle participants, count 0" }),
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "DRAW AGAIN" }),
    ).toBeInTheDocument();
  });

  it("LIVE DRAW automatically uses the server result and then says DRAW AGAIN", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(successfulPlayerResponse("Sarah", "sarah"));
    vi.stubGlobal("fetch", fetchMock);

    renderWithPlayers();
    startLiveDraw();
    await finishDraw();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/player-spin",
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getAllByText("WINNING PLAYER").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Sarah").length).toBeGreaterThan(0);
    expect(screen.getByText("Recent Winners")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "DRAW AGAIN" }),
    ).toBeInTheDocument();
  });

  it("preserves recent winners when returning from Live Draw Mode to Setup Mode", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(successfulPlayerResponse("Sarah", "sarah"));
    vi.stubGlobal("fetch", fetchMock);

    renderWithPlayers();
    startLiveDraw();
    await finishDraw();

    fireEvent.click(
      screen.getByRole("button", { name: "Close player result" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "EDIT PLAYERS" }));

    expect(screen.getByText("Paste Names")).toBeInTheDocument();
    expect(screen.getByText("Recent Winners")).toBeInTheDocument();
    expect(screen.getAllByText("Sarah").length).toBeGreaterThan(0);
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("LIVE DRAW begins READY to 3, 2, 1 countdown while the API request starts immediately", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(successfulPlayerResponse("Sarah", "sarah"));
    vi.stubGlobal("fetch", fetchMock);

    renderWithPlayers();
    startLiveDraw();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByText("PLAYER DRAW")).toBeInTheDocument();
    expect(screen.getAllByText("READY").length).toBeGreaterThan(0);
    expect(screen.queryByText("WINNING PLAYER")).not.toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(700);
    });
    expect(screen.getByText("3")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(650);
    });
    expect(screen.getByText("2")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(650);
    });
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.queryByText("WINNING PLAYER")).not.toBeInTheDocument();
  });

  it("does not show a fake frontend winner before the server result resolves", async () => {
    let resolveFetch: (response: Response) => void = () => {};
    const fetchMock = vi.fn().mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    renderWithPlayers();
    startLiveDraw();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3500);
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
    const fetchMock = vi
      .fn()
      .mockResolvedValue(successfulPlayerResponse("Jason", "jason"));
    vi.stubGlobal("fetch", fetchMock);

    renderWithPlayers();
    startLiveDraw();
    await finishDraw();

    const delays = timeoutSpy.mock.calls.map((call) => call[1]);
    expect(delays).toEqual(expect.arrayContaining([100, 140, 190, 260, 1200]));
    expect(delays).not.toContain(470);
    expect(delays).not.toContain(620);
    expect(screen.getAllByText("Jason").length).toBeGreaterThan(0);
  });

  it("changes final status to WINNING PLAYER only when the server winner is reached", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(successfulPlayerResponse("Wendy", "wendy"));
    vi.stubGlobal("fetch", fetchMock);

    renderWithPlayers();
    startLiveDraw();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(screen.getAllByText("READY").length).toBeGreaterThan(0);
    expect(screen.queryByText("WINNING PLAYER")).not.toBeInTheDocument();

    await finishDraw();

    expect(screen.getAllByText("WINNING PLAYER").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Wendy").length).toBeGreaterThan(0);
  });

  it("API failure stops rolling without showing a winner", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "No draw." }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    renderWithPlayers();
    startLiveDraw();

    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(screen.queryByText("WINNING PLAYER")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText("Unable to draw player")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "TRY AGAIN" }),
    ).toBeInTheDocument();
  });

  it("TRY AGAIN runs a new authoritative draw after a failed first live draw", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "No draw." }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(successfulPlayerResponse("Sarah", "sarah"));
    vi.stubGlobal("fetch", fetchMock);

    renderWithPlayers();
    startLiveDraw();

    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    fireEvent.click(screen.getByRole("button", { name: "TRY AGAIN" }));
    await finishDraw();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(screen.getAllByText("WINNING PLAYER").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Sarah").length).toBeGreaterThan(0);
  });

  it("DRAW AGAIN triggers a countdown and one new authoritative draw", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(successfulPlayerResponse("Sarah", "sarah"))
      .mockResolvedValueOnce(successfulPlayerResponse("Wendy", "wendy"));
    vi.stubGlobal("fetch", fetchMock);

    renderWithPlayers();
    startLiveDraw();
    await finishDraw();
    fireEvent.click(
      screen.getByRole("button", { name: "Close player result" }),
    );

    fireEvent.click(screen.getByRole("button", { name: "DRAW AGAIN" }));

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(screen.getAllByText("READY").length).toBeGreaterThan(0);
    await finishDraw();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(screen.getAllByText("WINNING PLAYER").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Wendy").length).toBeGreaterThan(0);
  });

  it("rapid taps on LIVE DRAW and DRAW AGAIN do not duplicate spin requests", async () => {
    let resolveFirst: (response: Response) => void = () => {};
    const fetchMock = vi
      .fn()
      .mockReturnValueOnce(
        new Promise<Response>((resolve) => {
          resolveFirst = resolve;
        }),
      )
      .mockResolvedValueOnce(successfulPlayerResponse("Wendy", "wendy"));
    vi.stubGlobal("fetch", fetchMock);

    renderWithPlayers();
    const liveButton = screen.getByRole("button", { name: "LIVE DRAW" });
    fireEvent.click(liveButton);
    fireEvent.click(liveButton);

    expect(fetchMock).toHaveBeenCalledTimes(1);

    resolveFirst(successfulPlayerResponse("Sarah", "sarah"));
    await finishDraw();
    fireEvent.click(
      screen.getByRole("button", { name: "Close player result" }),
    );

    const drawAgainButton = screen.getByRole("button", { name: "DRAW AGAIN" });
    fireEvent.click(drawAgainButton);
    fireEvent.click(drawAgainButton);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("private player audience shows mode badge without exposing pending winner controls", () => {
    render(
      <LuckyPlayerHome
        initialParticipants={[
          { id: "ali", displayName: "Ali", reference: "001", isEligible: true },
          {
            id: "sarah",
            displayName: "Sarah",
            reference: "002",
            isEligible: true,
          },
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
          showParticipantList: true,
        }}
      />,
    );

    expect(screen.getByText("OPERATOR DRAW")).toBeInTheDocument();
    expect(
      screen.getByText("Local RandomSpin Player Test"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Next Winner/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Admin/i)).not.toBeInTheDocument();
    expect(screen.queryByText("sarah")).not.toBeInTheDocument();
  });

  it("keeps a private player audience presentation-only without an operator session", () => {
    render(
      <LuckyPlayerHome
        initialParticipants={[]}
        mode={{
          kind: "private",
          publicCode: "PLAYTEST",
          spinEndpoint: "/api/player-draw/PLAYTEST/spin",
          label: "RANDOM DRAW",
          eventName: "Private Player Draw",
          participantCount: 2,
          eligibleCount: 2,
          removeWinnerAfterWin: false,
          showParticipantList: false,
          canOperate: false,
        }}
      />,
    );

    expect(
      screen.queryByRole("button", { name: /DRAW PLAYER|DRAW AGAIN/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "SHUFFLE" }),
    ).not.toBeInTheDocument();
  });

  it("persists private operator participant replacement before updating the live list", async () => {
    const savedParticipants = [
      { id: "alice", displayName: "Alice", reference: null, isEligible: true },
      { id: "ben", displayName: "Ben", reference: null, isEligible: true }
    ];
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ participants: savedParticipants, revision: "2026-08-21T00:01:00.000Z" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <LuckyPlayerHome
        initialParticipants={[]}
        mode={{
          kind: "private",
          publicCode: "PLAYTEST",
          spinEndpoint: "/api/player-draw/PLAYTEST/spin",
          label: "RANDOM DRAW",
          eventName: "Friday Player Draw",
          participantCount: 0,
          eligibleCount: 0,
          removeWinnerAfterWin: false,
          showParticipantList: true,
          canOperate: true,
          drawId: "player-draw-1",
          drawMode: "RANDOM",
          showReferencesPublicly: true,
          revision: "2026-08-21T00:00:00.000Z"
        }}
      />
    );

    fireEvent.change(screen.getByPlaceholderText("Paste one player per line"), { target: { value: "Alice\nBen" } });
    fireEvent.click(screen.getByRole("button", { name: "USE NAMES" }));

    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText("2 PLAYERS READY")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/player-draws/player-draw-1/participants",
      expect.objectContaining({ method: "PUT", body: expect.stringContaining('"participants"') })
    );
  });

  it("locks both draw actions until a private participant save succeeds", async () => {
    let resolveSave: ((response: Response) => void) | undefined;
    const fetchMock = vi.fn().mockImplementation(
      () => new Promise<Response>((resolve) => {
        resolveSave = resolve;
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <LuckyPlayerHome
        initialParticipants={[]}
        mode={{
          kind: "private",
          publicCode: "PLAYTEST",
          spinEndpoint: "/api/player-draw/PLAYTEST/spin",
          label: "RANDOM DRAW",
          eventName: "Friday Player Draw",
          participantCount: 0,
          eligibleCount: 0,
          removeWinnerAfterWin: false,
          showParticipantList: true,
          canOperate: true,
          drawId: "player-draw-1",
          drawMode: "RANDOM",
          revision: "2026-08-21T00:00:00.000Z",
        }}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("Paste one player per line"), {
      target: { value: "Alice\nBen" },
    });
    fireEvent.click(screen.getByRole("button", { name: "USE NAMES" }));

    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByRole("button", { name: "LIVE DRAW" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "DRAW PLAYER" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "DRAW PLAYER" }));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    resolveSave?.(
      new Response(
        JSON.stringify({
          participants: [
            { id: "alice", displayName: "Alice", reference: null, isEligible: true },
            { id: "ben", displayName: "Ben", reference: null, isEligible: true },
          ],
          revision: "2026-08-21T00:01:00.000Z",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByRole("button", { name: "LIVE DRAW" })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "DRAW PLAYER" })).not.toBeDisabled();
  });

  it("resyncs the authoritative participant list and reports a revision conflict", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        error: "Player list changed on another device. Refresh and try again.",
        participants: [
          { id: "alice", displayName: "Alice", reference: null, isEligible: true },
          { id: "server-ben", displayName: "Ben", reference: null, isEligible: true },
        ],
        revision: "2026-08-21T00:01:00.000Z",
      }), {
        status: 409,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <LuckyPlayerHome
        initialParticipants={[{ id: "alice", displayName: "Alice", reference: null, isEligible: true }]}
        mode={{
          kind: "private",
          publicCode: "PLAYTEST",
          spinEndpoint: "/api/player-draw/PLAYTEST/spin",
          label: "RANDOM DRAW",
          eventName: "Friday Player Draw",
          participantCount: 1,
          eligibleCount: 1,
          removeWinnerAfterWin: false,
          showParticipantList: true,
          canOperate: true,
          drawId: "player-draw-1",
          drawMode: "RANDOM",
          revision: "2026-08-21T00:00:00.000Z",
        }}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("Paste one player per line"), {
      target: { value: "Alice\nBen" },
    });
    fireEvent.click(screen.getByRole("button", { name: "USE NAMES" }));
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText("2 PLAYERS READY")).toBeInTheDocument();
    expect(screen.getByText("Player list changed on another device. Refresh and try again.")).toBeInTheDocument();
  });

  it("keeps hidden-list roller frames and references private on the broadcast surface", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successfulPlayerResponse("Ben", "ben"));
    vi.stubGlobal("fetch", fetchMock);

    render(
      <LuckyPlayerHome
        initialParticipants={[
          { id: "alice", displayName: "Alice", reference: "A-001", isEligible: true },
          { id: "ben", displayName: "Ben", reference: "B-002", isEligible: true },
        ]}
        mode={{
          kind: "private",
          publicCode: "PLAYTEST",
          spinEndpoint: "/api/player-draw/PLAYTEST/spin",
          label: "RANDOM DRAW",
          eventName: "Friday Player Draw",
          participantCount: 2,
          eligibleCount: 2,
          removeWinnerAfterWin: false,
          showParticipantList: false,
          showReferencesPublicly: false,
          canOperate: true,
          drawId: "player-draw-1",
          drawMode: "RANDOM",
          revision: "2026-08-21T00:00:00.000Z",
        }}
      />,
    );

    expect(screen.queryByText("Alice")).not.toBeInTheDocument();
    expect(screen.queryByText("A-001")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "DRAW PLAYER" }));
    await act(async () => {
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(3500);
    });

    expect(screen.getByText("ROLLING...")).toBeInTheDocument();
    expect(screen.queryByText("Alice")).not.toBeInTheDocument();
    expect(screen.queryByText("Ben")).not.toBeInTheDocument();
    expect(screen.getByText(/PLAYER [1-9]/)).toBeInTheDocument();
  });

  it("does not put a hidden private reference into the winner modal", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successfulPlayerResponse("Ben", "ben"));
    vi.stubGlobal("fetch", fetchMock);

    render(
      <LuckyPlayerHome
        initialParticipants={[
          { id: "alice", displayName: "Alice", reference: "A-001", isEligible: true },
          { id: "ben", displayName: "Ben", reference: "B-002", isEligible: true },
        ]}
        mode={{
          kind: "private",
          publicCode: "PLAYTEST",
          spinEndpoint: "/api/player-draw/PLAYTEST/spin",
          label: "RANDOM DRAW",
          eventName: "Friday Player Draw",
          participantCount: 2,
          eligibleCount: 2,
          removeWinnerAfterWin: false,
          showParticipantList: true,
          showReferencesPublicly: false,
          canOperate: true,
          drawId: "player-draw-1",
          drawMode: "RANDOM",
          revision: "2026-08-21T00:00:00.000Z",
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "DRAW PLAYER" }));
    await finishDraw();

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.queryByText("Reference: 002")).not.toBeInTheDocument();
  });

  it("keeps an authenticated operator editor separate from a hidden presentation list", () => {
    render(
      <LuckyPlayerHome
        initialParticipants={[{ id: "alice", displayName: "Alice", reference: "A-001", isEligible: true }]}
        mode={{
          kind: "private",
          publicCode: "PLAYTEST",
          spinEndpoint: "/api/player-draw/PLAYTEST/spin",
          label: "RANDOM DRAW",
          eventName: "Friday Player Draw",
          participantCount: 1,
          eligibleCount: 1,
          removeWinnerAfterWin: false,
          showParticipantList: false,
          showReferencesPublicly: false,
          canOperate: true,
          drawId: "player-draw-1",
          drawMode: "RANDOM",
          revision: "2026-08-21T00:00:00.000Z",
        }}
      />,
    );

    expect(screen.queryByText("Alice")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "OPEN PRIVATE EDITOR" }));
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Reference: A-001")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove Alice" })).toBeInTheDocument();
  });

  it("persists canonical membership order after a presentation shuffle", async () => {
    const privateParticipants = drawParticipants.slice(0, 3);
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          participants: privateParticipants,
          revision: "2026-08-21T00:01:00.000Z",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0);
    vi.stubGlobal("fetch", fetchMock);

    render(
      <LuckyPlayerHome
        initialParticipants={privateParticipants}
        mode={{
          kind: "private",
          publicCode: "PLAYTEST",
          spinEndpoint: "/api/player-draw/PLAYTEST/spin",
          label: "RANDOM DRAW",
          eventName: "Friday Player Draw",
          participantCount: 3,
          eligibleCount: 3,
          removeWinnerAfterWin: false,
          showParticipantList: true,
          canOperate: true,
          drawId: "player-draw-1",
          drawMode: "RANDOM",
          revision: "2026-08-21T00:00:00.000Z",
        }}
      />,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Shuffle participants, count 0" })[0]);
    fireEvent.change(screen.getByPlaceholderText("Add player name"), {
      target: { value: "Dina" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add participant" }));
    await act(async () => {
      await Promise.resolve();
    });
    randomSpy.mockRestore();

    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const saved = JSON.parse(String(request.body)) as {
      participants: Array<{ id: string }>;
    };
    expect(saved.participants.slice(0, 3).map((participant) => participant.id)).toEqual(
      privateParticipants.map((participant) => participant.id),
    );
  });

  it("keeps Draw Player disabled when a private player draw has zero eligible players", () => {
    render(
      <LuckyPlayerHome
        initialParticipants={[]}
        mode={{
          kind: "private",
          publicCode: "PLAYTEST",
          spinEndpoint: "/api/player-draw/PLAYTEST/spin",
          label: "RANDOM DRAW",
          eventName: "Empty Private Player Test",
          participantCount: 0,
          eligibleCount: 0,
          removeWinnerAfterWin: false,
          showParticipantList: true,
        }}
      />,
    );

    expect(screen.getByRole("button", { name: "DRAW PLAYER" })).toBeDisabled();
  });

  it("private recent winners stay hidden when the private setting is off", () => {
    render(
      <LuckyPlayerHome
        initialParticipants={[
          { id: "ali", displayName: "Ali", reference: "001", isEligible: true },
        ]}
        mode={{
          kind: "private",
          publicCode: "PLAYTEST",
          spinEndpoint: "/api/player-draw/PLAYTEST/spin",
          label: "RANDOM DRAW",
          eventName: "Local RandomSpin Player Test",
          participantCount: 1,
          eligibleCount: 1,
          removeWinnerAfterWin: false,
          showParticipantList: false,
        }}
      />,
    );

    expect(screen.queryByText("Recent Winners")).not.toBeInTheDocument();
    expect(
      screen.getByText("Participant list is hidden for this event."),
    ).toBeInTheDocument();
    expect(screen.queryByText("ali")).not.toBeInTheDocument();
  });

  it("LIVE DRAW hides setup controls and Edit Players restores them with participants preserved", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(successfulPlayerResponse("Sarah", "sarah"));
    vi.stubGlobal("fetch", fetchMock);

    renderWithPlayers();

    expect(
      screen.getByRole("button", { name: "LIVE DRAW" }),
    ).not.toBeDisabled();
    expect(screen.getByText("Paste Names")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Add player name")).toBeInTheDocument();

    startLiveDraw();

    expect(screen.queryByText("Paste Names")).not.toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText("Add player name"),
    ).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Search")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "DRAWING" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Shuffle participants, count 0" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Turn sound off" })).toHaveClass(
      "size-12",
    );
    expect(screen.getByRole("button", { name: "Full screen" })).toHaveClass(
      "size-12",
    );

    await finishDraw();
    fireEvent.click(
      screen.getByRole("button", { name: "Close player result" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "EDIT PLAYERS" }));

    expect(screen.getByText("Paste Names")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Add player name")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("buttons are disabled during active draw and restored after failure", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "No draw." }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    renderWithPlayers();
    startLiveDraw();

    expect(screen.getByRole("button", { name: "DRAWING" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Shuffle participants, count 0" }),
    ).toBeDisabled();

    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(
      screen.getByRole("button", { name: "TRY AGAIN" }),
    ).not.toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Shuffle participants, count 0" }),
    ).not.toBeDisabled();
  });

  it("private Random label remains unchanged", () => {
    render(
      <LuckyPlayerHome
        initialParticipants={[
          { id: "ali", displayName: "Ali", reference: "001", isEligible: true },
        ]}
        mode={{
          kind: "private",
          publicCode: "PLAYTEST",
          spinEndpoint: "/api/player-draw/PLAYTEST/spin",
          label: "RANDOM DRAW",
          eventName: "Local RandomSpin Player Test",
          participantCount: 1,
          eligibleCount: 1,
          removeWinnerAfterWin: false,
          showParticipantList: true,
        }}
      />,
    );

    expect(screen.getByText("RANDOM DRAW")).toBeInTheDocument();
    expect(screen.queryByText("OPERATOR DRAW")).not.toBeInTheDocument();
  });

  it("operator audience uses the same server-returned winner ending without exposing the pending participant early", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(successfulPlayerResponse("Sarah", "sarah"));
    vi.stubGlobal("fetch", fetchMock);

    render(
      <LuckyPlayerHome
        initialParticipants={[
          {
            id: "public-1",
            displayName: "Ali",
            reference: "001",
            isEligible: true,
          },
          {
            id: "public-2",
            displayName: "Sarah",
            reference: "002",
            isEligible: true,
          },
          {
            id: "public-3",
            displayName: "David",
            reference: "003",
            isEligible: true,
          },
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
          showParticipantList: true,
        }}
      />,
    );

    expect(screen.queryByText("WINNING PLAYER")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "DRAW PLAYER" }));
    await finishDraw();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/player-draw/PLAYTEST/spin",
      expect.objectContaining({ method: "POST" }),
    );
    expect(screen.getAllByText("WINNING PLAYER").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Sarah").length).toBeGreaterThan(0);
  });

  it("shows references for duplicate names when references are available", () => {
    render(
      <LuckyPlayerHome
        initialParticipants={[
          {
            id: "public-1",
            displayName: "James Lee",
            reference: "001",
            isEligible: true,
          },
          {
            id: "public-2",
            displayName: "James Lee",
            reference: "032",
            isEligible: true,
          },
          {
            id: "public-3",
            displayName: "James Lee",
            reference: "048",
            isEligible: true,
          },
        ]}
      />,
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
          {
            id: "public-1",
            displayName: "James Lee",
            reference: null,
            isEligible: true,
          },
          {
            id: "public-2",
            displayName: "James Lee",
            reference: null,
            isEligible: true,
          },
        ]}
      />,
    );

    expect(screen.getByText("· #1")).toBeInTheDocument();
    expect(screen.getByText("· #2")).toBeInTheDocument();
  });
});
