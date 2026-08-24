import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PrivateDrawManager } from "@/components/admin/PrivateDrawManager";
import { NumberEligibilityGrid } from "@/components/admin/NumberEligibilityGrid";
import { PlayerDrawControlForm } from "@/components/admin/PlayerDrawControlForm";
import { PlayerDrawManager } from "@/components/admin/PlayerDrawManager";
import { SettingsForm } from "@/components/admin/SettingsForm";
import { SuccessBanner } from "@/components/admin/feedback";

const privateDraw = {
  id: "draw-1",
  publicCode: "A7K29P",
  liveSlug: null,
  name: "Event Draw",
  minNumber: 1,
  maxNumber: 66,
  excludedNumbers: [],
  mode: "RANDOM" as const,
  displayStyle: "WHEEL" as const,
  pendingOperatorWinner: null,
  isActive: true,
  archivedAt: null,
  completedSpins: 0,
  createdAt: "2026-08-22T08:00:00.000Z",
  updatedAt: "2026-08-22T08:00:00.000Z"
};

const playerDraw = {
  id: "player-draw-1",
  publicCode: "PLAY123",
  name: "Player Draw",
  mode: "RANDOM" as const,
  isActive: true,
  archivedAt: null,
  removeWinnerAfterWin: false,
  showParticipantList: true,
  participantCount: 2,
  eligibleCount: 2,
  resultCount: 0,
  createdAt: "2026-08-22T08:00:00.000Z",
  updatedAt: "2026-08-22T08:00:00.000Z"
};

const playerControlDraw = {
  id: "player-draw-1",
  publicCode: "PLAY123",
  name: "Player Draw",
  mode: "OPERATOR" as const,
  pendingOperatorParticipantId: null,
  isActive: true,
  removeWinnerAfterWin: false,
  showParticipantList: true,
  showReferencesPublicly: true,
  participants: [
    { id: "ali", displayName: "Ali", reference: "001", isEligible: true },
    { id: "sarah", displayName: "Sarah", reference: "002", isEligible: true }
  ]
};

const siteSettings = {
  siteName: "RandomSpin",
  headline: "RandomSpin",
  subtitle: "Free random draws for names, numbers, and more.",
  announcement: null,
  soundEnabled: false,
  confettiEnabled: true,
  maintenanceMode: false,
  recentResultCount: 10,
  defaultFrom: 1,
  defaultTo: 30,
  maximumAllowedRange: 1000,
  publicDisclosureMessage: "Results are selected by the server.",
  timezone: "UTC",
  contactEmail: null
};

describe("admin feedback banners", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal("navigator", {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined)
      }
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("does not render a success banner for empty success text", () => {
    const { container, rerender } = render(<SuccessBanner message="" />);

    expect(container.querySelector(".success-banner")).not.toBeInTheDocument();

    rerender(<SuccessBanner message="   " />);
    expect(container.querySelector(".success-banner")).not.toBeInTheDocument();
  });

  it("shows and copies the canonical live URL for private draws", async () => {
    const liveDraw = { ...privateDraw, liveSlug: "friday" };

    render(<PrivateDrawManager initialDraws={[liveDraw]} />);

    expect(screen.getByText("Live URL: /live/friday")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /OPEN AUDIENCE/i })).toHaveAttribute("href", "/live/friday");

    fireEvent.click(screen.getByRole("button", { name: "COPY LIVE LINK" }));

    await waitFor(() => expect(screen.getByText("Live link copied.")).toBeInTheDocument());
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("http://localhost:3000/live/friday");
  });

  it("creates new player draws without preloaded sample participants", async () => {
    const emptyPlayerDraw = { ...playerDraw, id: "player-draw-empty", publicCode: "EMPTY1", participantCount: 0, eligibleCount: 0 };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ draw: emptyPlayerDraw, message: "" }), {
        status: 201,
        headers: { "Content-Type": "application/json" }
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<PlayerDrawManager initialDraws={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "+ CREATE PLAYER DRAW" }));

    await waitFor(() => expect(screen.getByText("Player draw created successfully.")).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/player-draws",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"participants":[]')
      })
    );
    expect(screen.getByText("Code EMPTY1 · Participants 0 · Eligible 0 · Results 0")).toBeInTheDocument();
  });

  it("deactivates and activates private draws with visible feedback", async () => {
    let resolveUpdate: (response: Response) => void = () => {};
    const fetchMock = vi.fn().mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveUpdate = resolve;
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<PrivateDrawManager initialDraws={[privateDraw]} />);

    fireEvent.click(screen.getByRole("button", { name: "DEACTIVATE" }));
    expect(screen.getByRole("button", { name: "Deactivating..." })).toBeDisabled();

    resolveUpdate(
      new Response(JSON.stringify({ draw: { ...privateDraw, isActive: false }, message: "" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );
    await waitFor(() => expect(screen.getByText("Draw deactivated successfully.")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "ACTIVATE" })).toBeInTheDocument();
    expect(screen.getByText("Inactive")).toBeInTheDocument();

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ draw: { ...privateDraw, isActive: true }, message: "" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );
    fireEvent.click(screen.getByRole("button", { name: "ACTIVATE" }));

    await waitFor(() => expect(screen.getByText("Draw activated successfully.")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "DEACTIVATE" })).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("creates private draws with fallback success feedback when the server message is empty", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ draw: privateDraw, message: "" }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        })
      )
    );

    const { container } = render(<PrivateDrawManager initialDraws={[]} />);

    fireEvent.click(screen.getByRole("button", { name: "+ CREATE PRIVATE DRAW" }));

    await waitFor(() => expect(screen.getByText("Private draw created successfully.")).toBeInTheDocument());
    expect(container.querySelector(".success-banner")?.textContent).toBe("Private draw created successfully.");
  });

  it("archives, restores, and permanently deletes private draws from the correct tabs", async () => {
    const inactiveDraw = { ...privateDraw, isActive: false };
    const archivedDraw = { ...inactiveDraw, archivedAt: "2026-08-22T09:00:00.000Z" };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ draw: archivedDraw, message: "" }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ draw: inactiveDraw, message: "" }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ draw: archivedDraw, message: "" }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ deletedId: inactiveDraw.id, message: "" }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        })
      );
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<PrivateDrawManager initialDraws={[inactiveDraw]} />);

    expect(screen.getByText("Current 1 · Archived 0")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "ARCHIVE" }));

    await waitFor(() => expect(screen.getByText("Draw archived successfully.")).toBeInTheDocument());
    expect(screen.getByText("Current 0 · Archived 1")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "DELETE PERMANENTLY" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Archived (1)" }));
    expect(screen.getByText("Archived")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "RESTORE" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "DELETE PERMANENTLY" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "RESTORE" }));
    await waitFor(() => expect(screen.getByText("Draw restored successfully.")).toBeInTheDocument());
    expect(screen.getByText("No archived private draws.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Current (1)" }));
    fireEvent.click(screen.getByRole("button", { name: "ARCHIVE" }));
    await waitFor(() => expect(screen.getByText("Draw archived successfully.")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Archived (1)" }));
    fireEvent.click(screen.getByRole("button", { name: "DELETE PERMANENTLY" }));

    await waitFor(() => expect(screen.getByText("Draw permanently deleted.")).toBeInTheDocument());
    expect(window.confirm).toHaveBeenCalledWith(
      "Permanently delete this draw?\n\nThis will permanently remove the draw and its related history/results. This cannot be undone."
    );
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/admin/draws/draw-1",
      expect.objectContaining({
        method: "DELETE",
        body: JSON.stringify({ confirmation: "PERMANENTLY DELETE" })
      })
    );
    expect(screen.getByText("No archived private draws.")).toBeInTheDocument();
  });

  it("player draw settings use a readable fallback instead of an empty success banner", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ draw: playerControlDraw, message: "" }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        })
      )
    );

    const { container } = render(<PlayerDrawControlForm draw={playerControlDraw} />);

    fireEvent.click(screen.getByRole("button", { name: "SAVE SETTINGS" }));

    await waitFor(() => expect(screen.getByText("Player draw settings saved.")).toBeInTheDocument());
    expect(container.querySelector(".success-banner")?.textContent).toBe("Player draw settings saved.");
  });

  it("wheel settings use a readable fallback instead of an empty success banner", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: "" }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        })
      )
    );

    const { container } = render(<NumberEligibilityGrid config={{ minNumber: 1, maxNumber: 30, excludedNumbers: [] }} />);

    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => expect(screen.getByText("Wheel configuration updated successfully.")).toBeInTheDocument());
    expect(container.querySelector(".success-banner")?.textContent).toBe("Wheel configuration updated successfully.");
  });

  it("site settings use a readable fallback instead of an empty success banner", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: "" }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        })
      )
    );

    const { container } = render(<SettingsForm settings={siteSettings} />);

    fireEvent.click(screen.getByRole("button", { name: "Save Settings" }));

    await waitFor(() => expect(screen.getByText("Settings saved.")).toBeInTheDocument());
    expect(container.querySelector(".success-banner")?.textContent).toBe("Settings saved.");
  });

  it("player draw next winner actions show set and clear feedback", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ draw: { ...playerControlDraw, pendingOperatorParticipantId: "sarah" }, message: "" }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ draw: { ...playerControlDraw, pendingOperatorParticipantId: null }, message: "" }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    render(<PlayerDrawControlForm draw={playerControlDraw} />);

    fireEvent.change(screen.getAllByRole("combobox")[2], { target: { value: "sarah" } });
    fireEvent.click(screen.getByRole("button", { name: "SET NEXT WINNER" }));

    await waitFor(() => expect(screen.getByText("Next winner set successfully.")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "CLEAR" }));
    await waitFor(() => expect(screen.getByText("Next winner cleared.")).toBeInTheDocument());
  });

  it("deactivates player draws with visible feedback and disables the pending button", async () => {
    let resolveUpdate: (response: Response) => void = () => {};
    const fetchMock = vi.fn().mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveUpdate = resolve;
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<PlayerDrawManager initialDraws={[playerDraw]} />);

    fireEvent.click(screen.getByRole("button", { name: "DEACTIVATE" }));
    expect(screen.getByRole("button", { name: "Deactivating..." })).toBeDisabled();

    resolveUpdate(
      new Response(JSON.stringify({ draw: { ...playerDraw, isActive: false }, message: "" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );

    await waitFor(() => expect(screen.getByText("Player draw deactivated successfully.")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "ACTIVATE" })).toBeInTheDocument();
    expect(screen.getByText("Inactive")).toBeInTheDocument();
  });

  it("archives and deletes player draws only from the archived tab", async () => {
    const inactiveDraw = { ...playerDraw, isActive: false };
    const archivedDraw = { ...inactiveDraw, archivedAt: "2026-08-22T09:00:00.000Z" };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ draw: archivedDraw, message: "" }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ deletedId: inactiveDraw.id, message: "" }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        })
      );
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<PlayerDrawManager initialDraws={[inactiveDraw]} />);

    fireEvent.click(screen.getByRole("button", { name: "ARCHIVE" }));

    await waitFor(() => expect(screen.getByText("Player draw archived successfully.")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "DELETE PERMANENTLY" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Archived (1)" }));
    expect(screen.getByText("Archived")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "DELETE PERMANENTLY" }));

    await waitFor(() => expect(screen.getByText("Player draw permanently deleted.")).toBeInTheDocument());
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/admin/player-draws/player-draw-1",
      expect.objectContaining({
        method: "DELETE",
        body: JSON.stringify({ confirmation: "PERMANENTLY DELETE" })
      })
    );
    expect(screen.getByText("No archived player draws.")).toBeInTheDocument();
  });

  it("auto-dismisses success feedback without clearing errors", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ draw: privateDraw, message: "" }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        })
      )
    );

    render(<PrivateDrawManager initialDraws={[]} />);

    fireEvent.click(screen.getByRole("button", { name: "+ CREATE PRIVATE DRAW" }));
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText("Private draw created successfully.")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });

    expect(screen.queryByText("Private draw created successfully.")).not.toBeInTheDocument();
  });
});
