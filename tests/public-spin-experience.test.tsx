import fs from "node:fs";
import path from "node:path";
import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LuckyWheel } from "@/components/public/LuckyWheel";
import { PublicHome } from "@/components/public/PublicHome";
import { WinnerModal } from "@/components/public/WinnerModal";

const settings = {
  siteName: "RandomSpin",
  headline: "RandomSpin",
  subtitle: "Free random draws for names, numbers, and more.",
  announcement: null,
  soundEnabled: false,
  confettiEnabled: true,
  defaultFrom: 1,
  defaultTo: 30,
  maximumAllowedRange: 1000,
  publicDisclosureMessage: "Results are selected from the configured eligible pool."
};

describe("public spin experience", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "requestAnimationFrame",
      (callback: FrameRequestCallback) => window.setTimeout(() => callback(performance.now()), 16) as unknown as number
    );
    vi.stubGlobal("cancelAnimationFrame", (id: number) => window.clearTimeout(id));
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation((query: string) => ({
        matches: query.includes("prefers-reduced-motion"),
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

  async function completeSuccessfulSpin() {
    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(8000);
    });
  }

  function expectWinnerNumber(winner: number) {
    expect(screen.getByText((_, element) => element?.textContent === `#${winner}`)).toBeInTheDocument();
  }

  function mockSpinResponses(...winners: number[]) {
    return vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      if (init?.method === "GET") {
        return Promise.resolve(
          new Response(JSON.stringify({ from: settings.defaultFrom, to: settings.defaultTo, label: "RANDOM DRAW", displayStyle: "WHEEL" }), {
            status: 200,
            headers: { "Content-Type": "application/json" }
          })
        );
      }

      const winner = winners.shift();

      if (winner === undefined) {
        throw new Error("No mocked spin response available.");
      }

      return Promise.resolve(
        new Response(
          JSON.stringify({
            spinId: `spin-${winner}-abcdef`,
            winner,
            timestamp: `2026-08-19T09:45:${String(winner).padStart(2, "0")}.000Z`,
            from: settings.defaultFrom,
            to: settings.defaultTo
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );
    });
  }

  function currentRollerValue() {
    return screen.getByTestId("number-roller-value").textContent ?? "";
  }

  function mockReducedMotion(matches: boolean) {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation((query: string) => ({
        matches: query.includes("prefers-reduced-motion") ? matches : false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn()
      }))
    );
  }

  it("shows SPIN before the first spin", () => {
    render(<LuckyWheel from={1} to={30} winner={null} rotation={0} spinning={false} onSpin={vi.fn()} />);

    expect(screen.getByRole("button", { name: "SPIN" })).toHaveTextContent("SPIN");
  });

  it("shows SPIN AGAIN after a result", () => {
    render(
      <LuckyWheel
        from={1}
        to={30}
        winner={26}
        highlightedWinner={26}
        rotation={0}
        spinning={false}
        buttonLabel="SPIN AGAIN"
        onSpin={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: "SPIN AGAIN" })).toHaveTextContent("SPIN AGAIN");
  });

  it("highlights the segment that matches the server winner", () => {
    render(<LuckyWheel from={1} to={30} winner={26} highlightedWinner={26} rotation={0} spinning={false} onSpin={vi.fn()} />);

    expect(screen.getByTestId("winning-segment")).toHaveAttribute("data-winning-number", "26");
  });

  it("shows server result details, keeps SPIN AGAIN after close, and leaves the selected range unchanged", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            spinId: "spin-abcdef-123456",
            winner: 26,
            timestamp: "2026-08-19T09:45:32.000Z"
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
    );

    render(<PublicHome settings={settings} initialResults={[]} />);
    expect(screen.getAllByRole("button", { name: "SPIN" }).length).toBeGreaterThan(0);
    expect(screen.getByText("RANDOM DRAW")).toBeInTheDocument();
    expect(screen.queryByText("PRIVATE EVENT DRAW")).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "SPIN" })[0]);
    await completeSuccessfulSpin();

    expect(fetch).toHaveBeenCalledWith("/api/spin", expect.objectContaining({ method: "POST" }));

    expect(screen.getByText(/Congratulations!/i)).toBeInTheDocument();
    expectWinnerNumber(26);
    expect(screen.getByText("1–30")).toBeInTheDocument();
    expect(screen.getAllByText("09:45:32 UTC").length).toBeGreaterThan(0);
    expect(screen.queryByText(/Spin ID/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/SPN-/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Server Generated/i)).not.toBeInTheDocument();
    expect(screen.getByRole("spinbutton", { name: "From" })).toHaveValue(1);
    expect(screen.getByRole("spinbutton", { name: "To" })).toHaveValue(30);
    expect(screen.getAllByRole("button", { name: "SPIN AGAIN" }).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Close result" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "SPIN AGAIN" }).length).toBeGreaterThan(0);

    fireEvent.change(screen.getByRole("spinbutton", { name: "To" }), { target: { value: "29" } });
    expect(screen.getByRole("spinbutton", { name: "From" })).toHaveValue(1);
    expect(screen.getByRole("spinbutton", { name: "To" })).toHaveValue(29);
    expect(screen.getAllByRole("button", { name: "SPIN AGAIN" }).length).toBeGreaterThan(0);
  });

  it("normalizes leading zero range input as base-10 integers", () => {
    render(<PublicHome settings={settings} initialResults={[]} />);

    fireEvent.change(screen.getByRole("spinbutton", { name: "From" }), { target: { value: "01" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: "To" }), { target: { value: "025" } });

    expect(screen.getByRole("spinbutton", { name: "From" })).toHaveValue(1);
    expect(screen.getByRole("spinbutton", { name: "To" })).toHaveValue(25);
  });

  it("public wheel can land on 24 for a visible 1-30 range", async () => {
    const fetchMock = mockSpinResponses(24);
    vi.stubGlobal("fetch", fetchMock);

    render(<PublicHome settings={settings} initialResults={[]} />);

    expect(screen.getByRole("spinbutton", { name: "From" })).toHaveValue(1);
    expect(screen.getByRole("spinbutton", { name: "To" })).toHaveValue(30);
    fireEvent.click(screen.getAllByRole("button", { name: "SPIN" })[0]);
    await completeSuccessfulSpin();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/spin",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ from: 1, to: 30 })
      })
    );
    expectWinnerNumber(24);
    expect(screen.getByTestId("winning-segment")).toHaveAttribute("data-winning-number", "24");
    expect(screen.getByText("1–30")).toBeInTheDocument();
  });

  it("public number roller can reveal 24 for a visible 1-30 range", async () => {
    const fetchMock = mockSpinResponses(24);
    vi.stubGlobal("fetch", fetchMock);

    render(<PublicHome settings={settings} initialResults={[]} />);

    fireEvent.click(screen.getByRole("button", { name: "Number" }));
    fireEvent.click(screen.getAllByRole("button", { name: "SPIN" })[0]);
    await completeSuccessfulSpin();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/spin",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ from: 1, to: 30 })
      })
    );
    expect(screen.getByTestId("number-roller-value")).toHaveTextContent("24");
    expectWinnerNumber(24);
  });

  it("renders winner metadata from the supplied server result", () => {
    render(
      <WinnerModal
        result={{ winner: 26, from: 1, to: 30, timestamp: "2026-08-19T09:45:32.000Z", spinId: "spin-abcdef-123456" }}
        onClose={vi.fn()}
        onShare={vi.fn()}
      />
    );

    expectWinnerNumber(26);
    expect(screen.getAllByText("09:45:32 UTC").length).toBeGreaterThan(0);
    expect(screen.queryByText(/Spin ID/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Server Generated/i)).not.toBeInTheDocument();
  });

  it("keeps SPIN AGAIN across consecutive successful spins and uses each new server result", async () => {
    const fetchMock = mockSpinResponses(26, 12, 7);
    vi.stubGlobal("fetch", fetchMock);

    render(<PublicHome settings={settings} initialResults={[]} />);

    expect(screen.getAllByRole("button", { name: "SPIN" }).length).toBeGreaterThan(0);
    expect(screen.getByRole("spinbutton", { name: "From" })).toHaveValue(1);
    expect(screen.getByRole("spinbutton", { name: "To" })).toHaveValue(30);

    fireEvent.click(screen.getAllByRole("button", { name: "SPIN" })[0]);
    await completeSuccessfulSpin();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expectWinnerNumber(26);
    expect(screen.getAllByRole("button", { name: "SPIN AGAIN" }).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Close result" }));

    fireEvent.click(screen.getAllByRole("button", { name: "SPIN AGAIN" })[0]);
    await completeSuccessfulSpin();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(screen.queryByText((_, element) => element?.textContent === "#26")).not.toBeInTheDocument();
    expectWinnerNumber(12);
    expect(screen.getAllByRole("button", { name: "SPIN AGAIN" }).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Close result" }));

    fireEvent.click(screen.getAllByRole("button", { name: "SPIN AGAIN" })[0]);
    await completeSuccessfulSpin();
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(screen.queryByText((_, element) => element?.textContent === "#12")).not.toBeInTheDocument();
    expectWinnerNumber(7);
    expect(screen.getAllByRole("button", { name: "SPIN AGAIN" }).length).toBeGreaterThan(0);
    expect(screen.getByRole("spinbutton", { name: "From" })).toHaveValue(1);
    expect(screen.getByRole("spinbutton", { name: "To" })).toHaveValue(30);
  });

  it("keeps private draw audience mode on the same RandomSpin public experience", async () => {
    const fetchMock = mockSpinResponses(21);
    vi.stubGlobal("fetch", fetchMock);

    render(
      <PublicHome
        settings={settings}
        initialResults={[]}
        drawMode={{
          kind: "private",
          publicCode: "A7K29P",
          label: "RANDOM DRAW",
          spinEndpoint: "/api/draw/A7K29P/spin"
        }}
      />
    );

    expect(screen.getAllByText(/RandomSpin/i).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: "Number Draw" })[0]).toHaveAttribute("href", "/");
    expect(screen.getAllByRole("link", { name: "Player Draw" })[0]).toHaveAttribute("href", "/players");
    expect(screen.getAllByRole("link", { name: "FAQ" })[0]).toHaveAttribute("href", "/faq");
    expect(screen.getAllByRole("link", { name: "About" })[0]).toHaveAttribute("href", "/about");
    expect(screen.getByRole("button", { name: "Wheel" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Number" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByLabelText("RandomSpin number wheel")).toBeInTheDocument();
    expect(screen.getByText("RANDOM DRAW")).toBeInTheDocument();
    expect(screen.queryByText("PRIVATE EVENT DRAW")).not.toBeInTheDocument();
    expect(screen.queryByText("A7K29P")).not.toBeInTheDocument();
    expect(screen.queryByText(/Admin/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Excluded/i)).not.toBeInTheDocument();
    expect(screen.getByText("A free web-based random draw tool for names, numbers, and more.")).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "SPIN" })[0]);
    await completeSuccessfulSpin();

    expect(fetchMock).toHaveBeenCalledWith("/api/draw/A7K29P/spin", expect.objectContaining({ method: "POST" }));
    expect(fetchMock).not.toHaveBeenCalledWith("/api/spin", expect.anything());
    expectWinnerNumber(21);
    expect(screen.getAllByText("09:45:21 UTC").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "SPIN AGAIN" }).length).toBeGreaterThan(0);
    expect(screen.getByRole("spinbutton", { name: "From" })).toHaveValue(1);
    expect(screen.getByRole("spinbutton", { name: "To" })).toHaveValue(30);
  });

  it("defaults the public homepage to Wheel and lets the user switch to Number and back without calling the API", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<PublicHome settings={settings} initialResults={[]} />);

    expect(screen.getByRole("button", { name: "Wheel" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("RandomSpin number wheel")).toBeInTheDocument();
    expect(screen.queryByTestId("number-roller-display")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Number" }));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Number" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("number-roller-display")).toBeInTheDocument();
    expect(screen.getByTestId("number-roller-value")).toHaveTextContent("?");
    expect(screen.getByText("READY")).toBeInTheDocument();
    expect(screen.getByText("Press SPIN to draw a number")).toBeInTheDocument();
    expect(screen.queryByLabelText("RandomSpin number wheel")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Wheel" }));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Wheel" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("RandomSpin number wheel")).toBeInTheDocument();
    expect(screen.queryByTestId("number-roller-display")).not.toBeInTheDocument();
  });

  it("private draw supports the same viewer-controlled Wheel and Number switch", () => {
    render(
      <PublicHome
        settings={settings}
        initialResults={[]}
        drawMode={{
          kind: "private",
          publicCode: "A7K29P",
          label: "RANDOM DRAW",
          displayStyle: "WHEEL",
          spinEndpoint: "/api/draw/A7K29P/spin"
        }}
      />
    );

    expect(screen.getByLabelText("RandomSpin number wheel")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Number" }));
    expect(screen.getByTestId("number-roller-display")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Wheel" }));
    expect(screen.getByLabelText("RandomSpin number wheel")).toBeInTheDocument();
  });

  it("private default view can open as Number while still allowing the viewer to switch to Wheel", () => {
    render(
      <PublicHome
        settings={settings}
        initialResults={[]}
        drawMode={{
          kind: "private",
          publicCode: "A7K29P",
          label: "RANDOM DRAW",
          displayStyle: "NUMBER_ROLLER",
          spinEndpoint: "/api/draw/A7K29P/spin"
        }}
      />
    );

    expect(screen.getByRole("button", { name: "Number" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("number-roller-display")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Wheel" }));
    expect(screen.getByLabelText("RandomSpin number wheel")).toBeInTheDocument();
  });

  it("falls back to wheel for an invalid private displayStyle", () => {
    render(
      <PublicHome
        settings={settings}
        initialResults={[]}
        drawMode={{
          kind: "private",
          publicCode: "A7K29P",
          label: "RANDOM DRAW",
          displayStyle: "BROKEN" as "WHEEL",
          spinEndpoint: "/api/draw/A7K29P/spin"
        }}
      />
    );

    expect(screen.getByLabelText("RandomSpin number wheel")).toBeInTheDocument();
    expect(screen.queryByTestId("number-roller-display")).not.toBeInTheDocument();
  });

  it("number roller uses the same private spin endpoint and lands on the server winner", async () => {
    const fetchMock = mockSpinResponses(18);
    vi.stubGlobal("fetch", fetchMock);

    render(
      <PublicHome
        settings={settings}
        initialResults={[]}
        drawMode={{
          kind: "private",
          publicCode: "A7K29P",
          label: "RANDOM DRAW",
          spinEndpoint: "/api/draw/A7K29P/spin"
        }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Number" }));
    fireEvent.click(screen.getAllByRole("button", { name: "SPIN" })[0]);
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText("RANDOMIZING")).toBeInTheDocument();
    expect(screen.queryByText("WINNING NUMBER")).not.toBeInTheDocument();
    await completeSuccessfulSpin();

    expect(fetchMock).toHaveBeenCalledWith("/api/draw/A7K29P/spin", expect.objectContaining({ method: "POST" }));
    expect(fetchMock).not.toHaveBeenCalledWith("/api/spin", expect.anything());
    expect(screen.getByTestId("number-roller-value")).toHaveTextContent("18");
    expect(screen.getByText("WINNING NUMBER")).toBeInTheDocument();
    expect(screen.getByText("Winning number 18")).toBeInTheDocument();
    expectWinnerNumber(18);
  });

  it("fast phase shows many varied placeholder updates before the clean slowdown", async () => {
    mockReducedMotion(false);
    const fetchMock = mockSpinResponses(18);
    vi.stubGlobal("fetch", fetchMock);

    render(<PublicHome settings={settings} initialResults={[]} />);

    fireEvent.click(screen.getByRole("button", { name: "Number" }));
    fireEvent.click(screen.getAllByRole("button", { name: "SPIN" })[0]);

    const seen: string[] = [];
    for (let index = 0; index < 16; index += 1) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60);
      });
      seen.push(currentRollerValue());
    }

    expect(new Set(seen).size).toBeGreaterThan(8);
    expect(seen.some((value, index) => index > 0 && value === seen[index - 1])).toBe(false);
    expect(screen.getByText("RANDOMIZING")).toBeInTheDocument();
    expect(screen.queryByText("WINNING NUMBER")).not.toBeInTheDocument();

    await completeSuccessfulSpin();
    expect(screen.getByTestId("number-roller-value")).toHaveTextContent("18");
  });

  it("minimum rolling duration applies before a fast API result can reveal the winner", async () => {
    mockReducedMotion(false);
    const fetchMock = mockSpinResponses(24);
    vi.stubGlobal("fetch", fetchMock);

    render(<PublicHome settings={settings} initialResults={[]} />);

    fireEvent.click(screen.getByRole("button", { name: "Number" }));
    fireEvent.click(screen.getAllByRole("button", { name: "SPIN" })[0]);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("WINNING NUMBER")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await completeSuccessfulSpin();
    expect(screen.getByTestId("number-roller-value")).toHaveTextContent("24");
    expect(screen.getByText("WINNING NUMBER")).toBeInTheDocument();
  });

  it("slow API responses keep neutral rolling without showing a fake winner", async () => {
    mockReducedMotion(false);
    let resolveSpin: (response: Response) => void = () => {};
    const delayedResponse = new Promise<Response>((resolve) => {
      resolveSpin = resolve;
    });
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(delayedResponse));

    render(<PublicHome settings={settings} initialResults={[]} />);

    fireEvent.click(screen.getByRole("button", { name: "Number" }));
    fireEvent.click(screen.getAllByRole("button", { name: "SPIN" })[0]);

    const seen: string[] = [];
    for (let index = 0; index < 12; index += 1) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(80);
      });
      seen.push(currentRollerValue());
    }

    expect(new Set(seen).size).toBeGreaterThan(6);
    expect(screen.getByText("RANDOMIZING")).toBeInTheDocument();
    expect(screen.queryByText("WINNING NUMBER")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    resolveSpin(
      new Response(JSON.stringify({ spinId: "spin-delayed", winner: 17, timestamp: "2026-08-19T09:45:17.000Z" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );
    await completeSuccessfulSpin();
    expect(screen.getByTestId("number-roller-value")).toHaveTextContent("17");
  });

  it("decorative placeholder randomness does not decide the final winner", async () => {
    const fetchMock = mockSpinResponses(22);
    vi.stubGlobal("fetch", fetchMock);

    render(
      <PublicHome
        settings={settings}
        initialResults={[]}
        drawMode={{
          kind: "private",
          publicCode: "A7K29P",
          label: "OPERATOR DRAW",
          spinEndpoint: "/api/draw/A7K29P/spin"
        }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Number" }));
    fireEvent.click(screen.getAllByRole("button", { name: "SPIN" })[0]);
    await completeSuccessfulSpin();

    expect(screen.getByTestId("number-roller-value")).toHaveTextContent("22");
  });

  it("number roller API failure stops without showing a fake winner", async () => {
    const fetchMock = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      if (init?.method === "GET") {
        return Promise.resolve(
          new Response(JSON.stringify({ from: 1, to: 30, label: "RANDOM DRAW", displayStyle: "NUMBER_ROLLER" }), {
            status: 200,
            headers: { "Content-Type": "application/json" }
          })
        );
      }

      return Promise.resolve(new Response(JSON.stringify({ error: "Draw is unavailable right now." }), { status: 500 }));
    });
    vi.stubGlobal(
      "fetch",
      fetchMock
    );

    render(
      <PublicHome
        settings={settings}
        initialResults={[]}
        drawMode={{
          kind: "private",
          publicCode: "A7K29P",
          label: "RANDOM DRAW",
          spinEndpoint: "/api/draw/A7K29P/spin"
        }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Number" }));
    fireEvent.click(screen.getAllByRole("button", { name: "SPIN" })[0]);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1200);
    });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText("WINNING NUMBER")).not.toBeInTheDocument();
    expect(screen.getByText("Unable to complete this spin. Please try again.")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "SPIN" }).length).toBeGreaterThan(0);
  });

  it("number roller keeps private operator and exclusion details hidden", () => {
    render(
      <PublicHome
        settings={settings}
        initialResults={[]}
        drawMode={{
          kind: "private",
          publicCode: "A7K29P",
          label: "OPERATOR DRAW",
          spinEndpoint: "/api/draw/A7K29P/spin"
        }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Number" }));
    expect(screen.getByText("OPERATOR DRAW")).toBeInTheDocument();
    expect(screen.queryByText(/pendingOperatorWinner/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/excludedNumbers/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/eligibleNumbers/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Next Winner/i)).not.toBeInTheDocument();
  });

  it("private operator badge returns to random after a confirmed winner is consumed", async () => {
    const fetchMock = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      if (init?.method === "GET") {
        return Promise.resolve(
          new Response(JSON.stringify({ from: 1, to: 30, label: "OPERATOR DRAW", displayStyle: "WHEEL" }), {
            status: 200,
            headers: { "Content-Type": "application/json" }
          })
        );
      }

      return Promise.resolve(
        new Response(
          JSON.stringify({
            spinId: "spin-operator-18",
            winner: 18,
            timestamp: "2026-08-19T09:45:18.000Z",
            from: 1,
            to: 30,
            mode: "OPERATOR",
            nextLabel: "RANDOM DRAW"
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <PublicHome
        settings={settings}
        initialResults={[]}
        drawMode={{
          kind: "private",
          publicCode: "A7K29P",
          label: "OPERATOR DRAW",
          spinEndpoint: "/api/draw/A7K29P/spin"
        }}
      />
    );

    expect(screen.getByText("OPERATOR DRAW")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "SPIN" })[0]);
    await completeSuccessfulSpin();

    expectWinnerNumber(18);
    expect(screen.getByText("RANDOM DRAW")).toBeInTheDocument();
    expect(screen.queryByText(/pendingOperatorWinner/i)).not.toBeInTheDocument();
  });

  it("no-pending private operator fallback completes without an audience error", async () => {
    const fetchMock = vi.fn().mockImplementation((_url: string, init?: RequestInit) =>
      Promise.resolve(
        new Response(
          JSON.stringify(
            init?.method === "GET"
              ? { from: 1, to: 66, label: "RANDOM DRAW", displayStyle: "WHEEL" }
              : {
                  spinId: "spin-random-fallback",
                  winner: 11,
                  timestamp: "2026-08-19T09:45:11.000Z",
                  from: 1,
                  to: 66,
                  mode: "RANDOM",
                  nextLabel: "RANDOM DRAW"
                }
          ),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <PublicHome
        settings={{ ...settings, defaultFrom: 1, defaultTo: 66, maximumAllowedRange: 1000 }}
        initialResults={[]}
        drawMode={{
          kind: "private",
          publicCode: "A7K29P",
          label: "RANDOM DRAW",
          spinEndpoint: "/api/draw/A7K29P/spin"
        }}
      />
    );

    fireEvent.click(screen.getAllByRole("button", { name: "SPIN" })[0]);
    await completeSuccessfulSpin();

    expect(fetchMock).toHaveBeenCalledWith("/api/draw/A7K29P/spin", expect.objectContaining({ method: "POST" }));
    expectWinnerNumber(11);
    expect(screen.getByText("RANDOM DRAW")).toBeInTheDocument();
    expect(screen.queryByText("Unable to complete this spin. Please try again.")).not.toBeInTheDocument();
    expect(screen.queryByText(/pendingOperatorWinner/i)).not.toBeInTheDocument();
  });

  it("does not show a three-number range error for valid private 1-66 draws", async () => {
    const fetchMock = vi.fn().mockImplementation((_url: string, init?: RequestInit) =>
      Promise.resolve(
        new Response(
          JSON.stringify(
            init?.method === "GET"
              ? { from: 1, to: 66, label: "RANDOM DRAW", displayStyle: "WHEEL" }
              : {
                  spinId: "spin-66",
                  winner: 42,
                  timestamp: "2026-08-19T09:45:42.000Z",
                  from: 1,
                  to: 66,
                  mode: "RANDOM",
                  nextLabel: "RANDOM DRAW"
                }
          ),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <PublicHome
        settings={{ ...settings, defaultFrom: 1, defaultTo: 66, maximumAllowedRange: 1000 }}
        initialResults={[]}
        drawMode={{
          kind: "private",
          publicCode: "A7K29P",
          label: "RANDOM DRAW",
          spinEndpoint: "/api/draw/A7K29P/spin"
        }}
      />
    );

    fireEvent.click(screen.getAllByRole("button", { name: "SPIN" })[0]);
    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(screen.queryByText("Please choose a range of 3 numbers or fewer.")).not.toBeInTheDocument();
    expect(screen.queryByText(/Please choose a range of .* numbers or fewer./)).not.toBeInTheDocument();
  });

  it("private live audience route uses the configured range safety limit, not the current draw size", () => {
    const routeSource = fs.readFileSync(path.join(process.cwd(), "app/live/[code]/page.tsx"), "utf8");

    expect(routeSource).toContain("maximumAllowedRange: PRIVATE_DRAW_MAXIMUM_RANGE");
    expect(routeSource).not.toContain("maximumAllowedRange: Math.max(draw.maxNumber - draw.minNumber + 1, 2)");
  });

  it("private audience uses server-returned range on the same draw URL", async () => {
    const fetchMock = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      if (init?.method === "GET") {
        return Promise.resolve(
          new Response(JSON.stringify({ from: 1, to: 30, label: "RANDOM DRAW", displayStyle: "WHEEL" }), {
            status: 200,
            headers: { "Content-Type": "application/json" }
          })
        );
      }

      return Promise.resolve(
        new Response(
          JSON.stringify({
            spinId: "spin-live-range",
            winner: 29,
            timestamp: "2026-08-19T09:45:29.000Z",
            from: 1,
            to: 30
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <PublicHome
        settings={{ ...settings, defaultFrom: 1, defaultTo: 28, maximumAllowedRange: 28 }}
        initialResults={[]}
        drawMode={{
          kind: "private",
          publicCode: "A7K29P",
          label: "RANDOM DRAW",
          spinEndpoint: "/api/draw/A7K29P/spin"
        }}
      />
    );

    fireEvent.click(screen.getAllByRole("button", { name: "SPIN" })[0]);
    await completeSuccessfulSpin();

    expect(screen.getByRole("spinbutton", { name: "To" })).toHaveValue(30);
    expectWinnerNumber(29);
  });

  it("private audience range is read-only and cannot imply a backend mutation", async () => {
    const fetchMock = mockSpinResponses(4);
    vi.stubGlobal("fetch", fetchMock);

    render(
      <PublicHome
        settings={{ ...settings, defaultFrom: 1, defaultTo: 5 }}
        initialResults={[]}
        drawMode={{
          kind: "private",
          publicCode: "A7K29P",
          label: "RANDOM DRAW",
          spinEndpoint: "/api/draw/A7K29P/spin"
        }}
      />
    );

    expect(screen.getByRole("spinbutton", { name: "From" })).toHaveAttribute("readonly");
    expect(screen.getByRole("spinbutton", { name: "To" })).toHaveAttribute("readonly");
    fireEvent.change(screen.getByRole("spinbutton", { name: "To" }), { target: { value: "025" } });

    expect(screen.getByRole("spinbutton", { name: "To" })).toHaveValue(5);
    fireEvent.click(screen.getAllByRole("button", { name: "SPIN" })[0]);
    await completeSuccessfulSpin();

    const postCall = fetchMock.mock.calls.find((call) => call[1]?.method === "POST");
    expect(postCall?.[1]).toEqual(expect.objectContaining({ body: "{}" }));
    expect(screen.getByText("1–30")).toBeInTheDocument();
  });

  it("private audience syncs the authoritative range before wheel spin", async () => {
    const fetchMock = vi.fn().mockImplementation((_url: string, init?: RequestInit) =>
      Promise.resolve(
        new Response(
          JSON.stringify(
            init?.method === "GET"
              ? { from: 1, to: 25, label: "RANDOM DRAW", displayStyle: "WHEEL" }
              : {
                  spinId: "spin-expanded-range",
                  winner: 25,
                  timestamp: "2026-08-19T09:45:25.000Z",
                  from: 1,
                  to: 25,
                  mode: "RANDOM",
                  nextLabel: "RANDOM DRAW"
                }
          ),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <PublicHome
        settings={{ ...settings, defaultFrom: 1, defaultTo: 5 }}
        initialResults={[]}
        drawMode={{
          kind: "private",
          publicCode: "A7K29P",
          label: "RANDOM DRAW",
          spinEndpoint: "/api/draw/A7K29P/spin"
        }}
      />
    );

    expect(screen.getByRole("spinbutton", { name: "To" })).toHaveValue(5);
    fireEvent.click(screen.getAllByRole("button", { name: "SPIN" })[0]);
    await completeSuccessfulSpin();

    expect(fetchMock.mock.calls.map((call) => call[1]?.method)).toEqual(["GET", "POST"]);
    expect(screen.getByRole("spinbutton", { name: "To" })).toHaveValue(25);
    expect(screen.getByTestId("winning-segment")).toHaveAttribute("data-winning-number", "25");
    expect(screen.getByText("1–25")).toBeInTheDocument();
  });

  it("private number roller syncs and displays the authoritative current range", async () => {
    const fetchMock = vi.fn().mockImplementation((_url: string, init?: RequestInit) =>
      Promise.resolve(
        new Response(
          JSON.stringify(
            init?.method === "GET"
              ? { from: 1, to: 25, label: "RANDOM DRAW", displayStyle: "NUMBER_ROLLER" }
              : {
                  spinId: "spin-roller-expanded-range",
                  winner: 25,
                  timestamp: "2026-08-19T09:45:25.000Z",
                  from: 1,
                  to: 25,
                  mode: "RANDOM",
                  nextLabel: "RANDOM DRAW"
                }
          ),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <PublicHome
        settings={{ ...settings, defaultFrom: 1, defaultTo: 5 }}
        initialResults={[]}
        drawMode={{
          kind: "private",
          publicCode: "A7K29P",
          label: "RANDOM DRAW",
          displayStyle: "NUMBER_ROLLER",
          spinEndpoint: "/api/draw/A7K29P/spin"
        }}
      />
    );

    fireEvent.click(screen.getAllByRole("button", { name: "SPIN" })[0]);
    await completeSuccessfulSpin();

    expect(screen.getByTestId("number-roller-display")).toHaveTextContent("Range 1-25");
    expect(screen.getByTestId("number-roller-value")).toHaveTextContent("25");
  });

  it("number roller supports SPIN AGAIN after the winner modal closes", async () => {
    const fetchMock = mockSpinResponses(9, 14);
    vi.stubGlobal("fetch", fetchMock);

    render(
      <PublicHome
        settings={settings}
        initialResults={[]}
        drawMode={{
          kind: "private",
          publicCode: "A7K29P",
          label: "RANDOM DRAW",
          spinEndpoint: "/api/draw/A7K29P/spin"
        }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Number" }));
    fireEvent.click(screen.getAllByRole("button", { name: "SPIN" })[0]);
    await completeSuccessfulSpin();
    expect(screen.getAllByRole("button", { name: "SPIN AGAIN" }).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Close result" }));

    fireEvent.click(screen.getAllByRole("button", { name: "SPIN AGAIN" })[0]);
    await completeSuccessfulSpin();

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls.filter((call) => call[1]?.method === "POST")).toHaveLength(2);
    expect(screen.getByTestId("number-roller-value")).toHaveTextContent("14");
    expect(screen.getAllByRole("button", { name: "SPIN AGAIN" }).length).toBeGreaterThan(0);
  });

  it("disables the view selector while spinning and re-enables it after a successful spin", async () => {
    let resolveSpin: (response: Response) => void = () => {};
    const delayedResponse = new Promise<Response>((resolve) => {
      resolveSpin = resolve;
    });
    const fetchMock = vi.fn().mockReturnValue(delayedResponse);
    vi.stubGlobal("fetch", fetchMock);

    render(<PublicHome settings={settings} initialResults={[]} />);

    fireEvent.click(screen.getAllByRole("button", { name: "SPIN" })[0]);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(96);
    });

    expect(screen.getByRole("button", { name: "Wheel" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Number" })).toBeDisabled();

    resolveSpin(
      new Response(JSON.stringify({ spinId: "spin-delayed", winner: 26, timestamp: "2026-08-19T09:45:32.000Z" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );
    await completeSuccessfulSpin();

    expect(screen.getByRole("button", { name: "Wheel" })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "Number" })).not.toBeDisabled();
  });

  it("re-enables the view selector after a failed spin", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "Spin failed." }), { status: 500 }))
    );

    render(<PublicHome settings={settings} initialResults={[]} />);

    fireEvent.click(screen.getAllByRole("button", { name: "SPIN" })[0]);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(screen.getByText("Unable to complete this spin. Please try again.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Wheel" })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "Number" })).not.toBeDisabled();
  });

  it("switching to Wheel after a Number result keeps the result state and does not spin again", async () => {
    const fetchMock = mockSpinResponses(18);
    vi.stubGlobal("fetch", fetchMock);

    render(<PublicHome settings={settings} initialResults={[]} />);

    fireEvent.click(screen.getByRole("button", { name: "Number" }));
    fireEvent.click(screen.getAllByRole("button", { name: "SPIN" })[0]);
    await completeSuccessfulSpin();
    expectWinnerNumber(18);
    fireEvent.click(screen.getByRole("button", { name: "Close result" }));

    fireEvent.click(screen.getByRole("button", { name: "Wheel" }));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("RandomSpin number wheel")).toBeInTheDocument();
    expect(screen.getAllByText("18").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "SPIN AGAIN" }).length).toBeGreaterThan(0);
  });

  it("shows the random draw badge for random private draws", () => {
    render(
      <PublicHome
        settings={settings}
        initialResults={[]}
        drawMode={{
          kind: "private",
          publicCode: "A7K29P",
          label: "RANDOM DRAW",
          spinEndpoint: "/api/draw/A7K29P/spin"
        }}
      />
    );

    expect(screen.getByText("RANDOM DRAW")).toBeInTheDocument();
    expect(screen.queryByText("OPERATOR DRAW")).not.toBeInTheDocument();
  });

  it("shows operator draw badge without revealing the selected winner before result", () => {
    render(
      <PublicHome
        settings={settings}
        initialResults={[]}
        drawMode={{
          kind: "private",
          publicCode: "A7K29P",
          label: "OPERATOR DRAW",
          spinEndpoint: "/api/draw/A7K29P/spin"
        }}
      />
    );

    expect(screen.getByText("OPERATOR DRAW")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText((_, element) => element?.textContent === "#18")).not.toBeInTheDocument();
    expect(screen.queryByText(/Next Winner/i)).not.toBeInTheDocument();
  });

  it("live audience route reuses PublicHome instead of cloning the public frontend", () => {
    const routeSource = fs.readFileSync(path.join(process.cwd(), "app/live/[code]/page.tsx"), "utf8");

    expect(routeSource).toContain('import { PublicHome } from "@/components/public/PublicHome"');
    expect(routeSource).toContain("<PublicHome");
    expect(routeSource).toContain("robots");
    expect(routeSource).toContain("index: false");
    expect(routeSource).toContain("getPrivateDrawLivePath");
    expect(routeSource).toContain("encodeURIComponent(draw.publicCode)");
    expect(routeSource).not.toContain("draw.liveSlug ?? draw.publicCode");
    expect(routeSource).not.toContain("LuckyWheel");
    expect(routeSource).not.toContain("WinnerModal");
    expect(routeSource).not.toContain("RangeSelector");
    expect(routeSource).not.toContain("RecentResults");
  });

  it("legacy draw audience route redirects to the canonical live URL", () => {
    const routeSource = fs.readFileSync(path.join(process.cwd(), "app/draw/[publicCode]/page.tsx"), "utf8");

    expect(routeSource).toContain("redirect(`/live/${encodeURIComponent(publicCode)}`)");
    expect(routeSource).not.toContain("<PublicHome");
    expect(routeSource).not.toContain("getPrivateDrawAudience");
  });

  it("keeps one shared spin controller for both visual views", () => {
    const publicHomeSource = fs.readFileSync(path.join(process.cwd(), "components/public/PublicHome.tsx"), "utf8");

    expect(publicHomeSource.match(/async function spin/g)?.length).toBe(1);
    expect(publicHomeSource).toContain('fetch(spinEndpoint');
    expect(publicHomeSource).toContain("showNumberRoller");
  });

  it("public homepage does not read private draw state", () => {
    const pageSource = fs.readFileSync(path.join(process.cwd(), "app/page.tsx"), "utf8");

    expect(pageSource).not.toContain("getPrivateDrawAudience");
    expect(pageSource).not.toContain("PrivateDraw");
    expect(pageSource).not.toContain("/api/draw/");
  });

  it("renders the view selector in a mobile-width structure without duplicating the visual area", () => {
    render(
      <div style={{ width: 375 }}>
        <PublicHome settings={settings} initialResults={[]} />
      </div>
    );

    expect(screen.getByRole("button", { name: "Wheel" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Number" })).toBeInTheDocument();
    expect(screen.getAllByLabelText("RandomSpin number wheel")).toHaveLength(1);
  });

  it("reset returns the spin button, range, and result state to the configured defaults", async () => {
    const fetchMock = mockSpinResponses(26);
    vi.stubGlobal("fetch", fetchMock);

    render(<PublicHome settings={settings} initialResults={[]} />);
    expect(screen.getAllByRole("button", { name: "SPIN" }).length).toBeGreaterThan(0);

    fireEvent.change(screen.getByRole("spinbutton", { name: "To" }), { target: { value: "29" } });
    expect(screen.getByRole("spinbutton", { name: "To" })).toHaveValue(29);

    fireEvent.click(screen.getAllByRole("button", { name: "SPIN" })[0]);
    await completeSuccessfulSpin();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expectWinnerNumber(26);
    expect(screen.getByTestId("winning-segment")).toHaveAttribute("data-winning-number", "26");
    expect(screen.getAllByRole("button", { name: "SPIN AGAIN" }).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(screen.getAllByRole("button", { name: "SPIN" }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText((_, element) => element?.textContent === "#26")).not.toBeInTheDocument();
    expect(screen.queryByTestId("winning-segment")).not.toBeInTheDocument();
    expect(screen.getByRole("spinbutton", { name: "From" })).toHaveValue(settings.defaultFrom);
    expect(screen.getByRole("spinbutton", { name: "To" })).toHaveValue(settings.defaultTo);
  });

  it("starts wheel motion before a delayed server response resolves and still lands on the server winner", async () => {
    let resolveSpin: (response: Response) => void = () => {};
    const delayedResponse = new Promise<Response>((resolve) => {
      resolveSpin = resolve;
    });
    const fetchMock = vi.fn().mockReturnValue(delayedResponse);
    vi.stubGlobal("fetch", fetchMock);

    render(<PublicHome settings={settings} initialResults={[]} />);
    const wheel = screen.getByLabelText("RandomSpin number wheel");

    fireEvent.click(screen.getAllByRole("button", { name: "SPIN" })[0]);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(96);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "SPINNING" })).toBeDisabled();
    expect(screen.getAllByRole("button", { name: "SPIN" })[0]).toBeDisabled();
    expect(wheel).not.toHaveStyle({ transform: "rotate(0deg)" });

    fireEvent.click(screen.getAllByRole("button", { name: "SPIN" })[0]);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    resolveSpin(
      new Response(JSON.stringify({ spinId: "spin-delayed", winner: 26, timestamp: "2026-08-19T09:45:32.000Z" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );
    await completeSuccessfulSpin();

    expectWinnerNumber(26);
    expect(screen.getByTestId("winning-segment")).toHaveAttribute("data-winning-number", "26");
    expect(screen.getAllByRole("button", { name: "SPIN AGAIN" }).length).toBeGreaterThan(0);
  });

  it("stops a failed delayed spin without showing a fake winner or making overlapping requests", async () => {
    let rejectSpin: (error: Error) => void = () => {};
    const delayedFailure = new Promise<Response>((_, reject) => {
      rejectSpin = reject;
    });
    const fetchMock = vi.fn().mockReturnValue(delayedFailure);
    vi.stubGlobal("fetch", fetchMock);

    render(<PublicHome settings={settings} initialResults={[]} />);
    const wheel = screen.getByLabelText("RandomSpin number wheel");

    fireEvent.click(screen.getAllByRole("button", { name: "SPIN" })[0]);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(96);
    });

    expect(wheel).not.toHaveStyle({ transform: "rotate(0deg)" });
    fireEvent.click(screen.getAllByRole("button", { name: "SPIN" })[0]);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    rejectSpin(new Error("network failed"));
    await act(async () => {
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(screen.getByText("Unable to complete this spin. Please try again.")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText(/^#/)).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "SPIN" }).length).toBeGreaterThan(0);
  });
});
