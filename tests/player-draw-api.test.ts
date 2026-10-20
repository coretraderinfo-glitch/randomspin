import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAdminFromRequest: vi.fn(),
  rateLimit: vi.fn(),
  playerDrawFindMany: vi.fn(),
  playerDrawFindUnique: vi.fn(),
  playerDrawCreate: vi.fn(),
  playerDrawUpdate: vi.fn(),
  playerDrawUpdateMany: vi.fn(),
  playerDrawDelete: vi.fn(),
  playerParticipantFindMany: vi.fn(),
  playerParticipantFindFirst: vi.fn(),
  playerParticipantCount: vi.fn(),
  playerParticipantDeleteMany: vi.fn(),
  playerParticipantCreateMany: vi.fn(),
  playerParticipantUpdate: vi.fn(),
  playerDrawResultCreate: vi.fn(),
  auditCreate: vi.fn(),
  transaction: vi.fn()
}));

vi.mock("@/lib/auth", () => ({ getAdminFromRequest: mocks.getAdminFromRequest }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: mocks.rateLimit }));
vi.mock("@/lib/db", () => ({
  prisma: {
    playerDraw: {
      findMany: mocks.playerDrawFindMany,
      findUnique: mocks.playerDrawFindUnique,
      create: mocks.playerDrawCreate,
      update: mocks.playerDrawUpdate,
      updateMany: mocks.playerDrawUpdateMany,
      delete: mocks.playerDrawDelete
    },
    playerParticipant: {
      findMany: mocks.playerParticipantFindMany,
      findFirst: mocks.playerParticipantFindFirst,
      count: mocks.playerParticipantCount,
      deleteMany: mocks.playerParticipantDeleteMany,
      createMany: mocks.playerParticipantCreateMany,
      update: mocks.playerParticipantUpdate
    },
    playerDrawResult: { create: mocks.playerDrawResultCreate },
    auditLog: { create: mocks.auditCreate },
    $transaction: mocks.transaction
  }
}));

const participants = [
  {
    id: "participant-ali",
    playerDrawId: "player-draw-1",
    displayName: "Ali",
    reference: "001",
    isEligible: true,
    createdAt: new Date("2026-08-21T00:00:00.000Z"),
    updatedAt: new Date("2026-08-21T00:00:00.000Z")
  },
  {
    id: "participant-sarah",
    playerDrawId: "player-draw-1",
    displayName: "Sarah",
    reference: "002",
    isEligible: true,
    createdAt: new Date("2026-08-21T00:01:00.000Z"),
    updatedAt: new Date("2026-08-21T00:01:00.000Z")
  },
  {
    id: "participant-david",
    playerDrawId: "player-draw-1",
    displayName: "David",
    reference: "003",
    isEligible: false,
    createdAt: new Date("2026-08-21T00:02:00.000Z"),
    updatedAt: new Date("2026-08-21T00:02:00.000Z")
  }
];

const baseDraw = {
  id: "player-draw-1",
  publicCode: "PLAYTEST",
  name: "Local RandomSpin Player Test",
  mode: "OPERATOR",
  pendingOperatorParticipantId: "participant-sarah",
  isActive: true,
  archivedAt: null,
  removeWinnerAfterWin: false,
  showParticipantList: true,
  showReferencesPublicly: true,
  createdAt: new Date("2026-08-21T00:00:00.000Z"),
  updatedAt: new Date("2026-08-21T00:00:00.000Z"),
  participants,
  results: []
};

function adminRequest(body: unknown) {
  return new NextRequest("http://localhost:3000/api/admin/player-draws/player-draw-1", {
    method: "PUT",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json", origin: "http://localhost:3000" }
  });
}

function participantRequest(body: unknown) {
  return new NextRequest("http://localhost:3000/api/admin/player-draws/player-draw-1/participants", {
    method: "PUT",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json", origin: "http://localhost:3000" }
  });
}

function adminPayload(overrides: Record<string, unknown> = {}) {
  return {
    name: baseDraw.name,
    mode: baseDraw.mode,
    isActive: baseDraw.isActive,
    removeWinnerAfterWin: baseDraw.removeWinnerAfterWin,
    showParticipantList: baseDraw.showParticipantList,
    showReferencesPublicly: baseDraw.showReferencesPublicly,
    ...overrides
  };
}

function audienceRequest(body: unknown = {}) {
  return new NextRequest("http://localhost:3000/api/player-draw/PLAYTEST/spin", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json", origin: "http://localhost:3000" }
  });
}

function publicPlayerRequest(body: unknown = {}) {
  return new NextRequest("http://localhost:3000/api/player-spin", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" }
  });
}

describe("RandomSpin Player Draw APIs", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getAdminFromRequest.mockResolvedValue({ id: "admin-1", email: "admin@luckyspin.local" });
    mocks.rateLimit.mockResolvedValue({ allowed: true });
    mocks.playerDrawFindMany.mockResolvedValue([{ ...baseDraw, _count: { results: 0 } }]);
    mocks.playerDrawFindUnique.mockResolvedValue(baseDraw);
    mocks.playerDrawCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      ...baseDraw,
      id: "created-player-draw",
      ...data
    }));
    mocks.playerDrawUpdate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ ...baseDraw, ...data }));
    mocks.playerDrawUpdateMany.mockResolvedValue({ count: 1 });
    mocks.playerDrawDelete.mockResolvedValue(baseDraw);
    mocks.playerParticipantFindMany.mockResolvedValue(participants.filter((participant) => participant.isEligible));
    mocks.playerParticipantFindFirst.mockImplementation(async ({ where }: { where: { id: string; isEligible?: boolean } }) => {
      const participant = participants.find((item) => item.id === where.id);
      return participant && (where.isEligible === undefined || participant.isEligible === where.isEligible) ? participant : null;
    });
    mocks.playerParticipantCount.mockResolvedValue(2);
    mocks.playerParticipantDeleteMany.mockResolvedValue({ count: 0 });
    mocks.playerParticipantCreateMany.mockResolvedValue({ count: 0 });
    mocks.playerParticipantUpdate.mockResolvedValue({ ...participants[1], isEligible: false });
    mocks.auditCreate.mockResolvedValue({});
    mocks.playerDrawResultCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: "player-result-1",
      ...data,
      createdAt: new Date("2026-08-21T01:02:03.000Z")
    }));
    mocks.transaction.mockImplementation(async (callback) =>
      callback({
        playerDraw: {
          findUnique: mocks.playerDrawFindUnique,
          create: mocks.playerDrawCreate,
          update: mocks.playerDrawUpdate,
          updateMany: mocks.playerDrawUpdateMany,
          delete: mocks.playerDrawDelete
        },
        playerParticipant: {
          findMany: mocks.playerParticipantFindMany,
          findFirst: mocks.playerParticipantFindFirst,
          count: mocks.playerParticipantCount,
          deleteMany: mocks.playerParticipantDeleteMany,
          createMany: mocks.playerParticipantCreateMany,
          update: mocks.playerParticipantUpdate
        },
        playerDrawResult: { create: mocks.playerDrawResultCreate }
      })
    );
  });

  it("player draw creation requires admin authentication", async () => {
    mocks.getAdminFromRequest.mockResolvedValue(null);
    const { POST } = await import("@/app/api/admin/player-draws/route");
    const response = await POST(
      new NextRequest("http://localhost:3000/api/admin/player-draws", {
        method: "POST",
        body: JSON.stringify({ name: "Nope", mode: "RANDOM", participants: [{ displayName: "Ali" }] }),
        headers: { "content-type": "application/json", origin: "http://localhost:3000" }
      })
    );

    expect(response.status).toBe(401);
    expect(mocks.playerDrawCreate).not.toHaveBeenCalled();
  });

  it("admin can create an active player draw with no participants", async () => {
    mocks.playerDrawFindUnique.mockResolvedValueOnce(null);
    const { POST } = await import("@/app/api/admin/player-draws/route");
    const response = await POST(
      new NextRequest("http://localhost:3000/api/admin/player-draws", {
        method: "POST",
        body: JSON.stringify({ name: "Friday Player Draw", mode: "RANDOM", participants: [] }),
        headers: { "content-type": "application/json", origin: "http://localhost:3000" }
      })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.draw).toEqual(expect.objectContaining({ participantCount: 0, eligibleCount: 0 }));
    expect(mocks.playerDrawCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ participants: { create: [] } }) })
    );
  });

  it("admin updates require authentication and publicCode does not grant admin rights", async () => {
    mocks.getAdminFromRequest.mockResolvedValue(null);
    const { PUT } = await import("@/app/api/admin/player-draws/[id]/route");
    const response = await PUT(adminRequest(adminPayload({ isActive: false })), {
      params: Promise.resolve({ id: "PLAYTEST" })
    });

    expect(response.status).toBe(401);
    expect(mocks.playerDrawUpdate).not.toHaveBeenCalled();
  });

  it("rejects legacy participant payloads on settings updates", async () => {
    const { PUT } = await import("@/app/api/admin/player-draws/[id]/route");
    const response = await PUT(adminRequest(adminPayload({
      participants: participants.map(({ id, displayName, reference, isEligible }) => ({
        id,
        displayName,
        reference,
        isEligible,
      })),
    })), { params: Promise.resolve({ id: "player-draw-1" }) });

    expect(response.status).toBe(400);
    expect(mocks.playerDrawUpdate).not.toHaveBeenCalled();
    expect(mocks.playerParticipantDeleteMany).not.toHaveBeenCalled();
    expect(mocks.playerParticipantCreateMany).not.toHaveBeenCalled();
  });

  it("settings and next-winner actions leave live participant membership and eligibility untouched", async () => {
    const liveParticipants = [
      ...participants.map((participant) => ({ ...participant })),
      {
        id: "participant-walk-in",
        playerDrawId: "player-draw-1",
        displayName: "Walk-in",
        reference: null,
        isEligible: true,
        createdAt: new Date("2026-08-21T00:03:00.000Z"),
        updatedAt: new Date("2026-08-21T00:03:00.000Z"),
      },
    ];
    const liveDraw = {
      ...baseDraw,
      participants: liveParticipants,
      removeWinnerAfterWin: true,
    };
    mocks.playerDrawFindUnique.mockResolvedValue(liveDraw);
    const { PUT } = await import("@/app/api/admin/player-draws/[id]/route");

    const setResponse = await PUT(
      adminRequest(adminPayload({
        mode: "OPERATOR",
        nextWinnerParticipantId: "participant-sarah",
        action: "set",
      })),
      { params: Promise.resolve({ id: "player-draw-1" }) },
    );
    const clearResponse = await PUT(
      adminRequest(adminPayload({ action: "clear" })),
      { params: Promise.resolve({ id: "player-draw-1" }) },
    );

    expect(setResponse.status).toBe(200);
    expect(clearResponse.status).toBe(200);
    expect(mocks.playerParticipantDeleteMany).not.toHaveBeenCalled();
    expect(mocks.playerParticipantCreateMany).not.toHaveBeenCalled();
    expect(mocks.playerParticipantUpdate).not.toHaveBeenCalled();
    expect(liveDraw.participants).toEqual(liveParticipants);
    expect(liveDraw.participants.find((participant) => participant.id === "participant-david")?.isEligible).toBe(false);
    expect(liveDraw.participants.find((participant) => participant.id === "participant-walk-in")).toBeDefined();
  });

  it("requires an authenticated admin for participant-only changes", async () => {
    mocks.getAdminFromRequest.mockResolvedValue(null);
    const { PUT } = await import("@/app/api/admin/player-draws/[id]/participants/route");
    const response = await PUT(participantRequest({
      revision: baseDraw.updatedAt.toISOString(),
      participants: participants.map(({ id, displayName, reference }) => ({ id, displayName, reference }))
    }), { params: Promise.resolve({ id: "player-draw-1" }) });

    expect(response.status).toBe(401);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("only updates participant data and preserves draw settings and an armed winner", async () => {
    const { PUT } = await import("@/app/api/admin/player-draws/[id]/participants/route");
    const response = await PUT(participantRequest({
      revision: baseDraw.updatedAt.toISOString(),
      participants: participants.map(({ id, displayName, reference }) => ({ id, displayName, reference }))
    }), { params: Promise.resolve({ id: "player-draw-1" }) });

    expect(response.status).toBe(200);
    expect(mocks.playerDrawUpdate).not.toHaveBeenCalled();
    expect(mocks.playerDrawUpdateMany).toHaveBeenCalledWith({
      where: { id: "player-draw-1", updatedAt: baseDraw.updatedAt },
      data: { updatedAt: expect.any(Date) }
    });
    expect(mocks.playerParticipantUpdate).toHaveBeenCalledWith({
      where: { id: "participant-sarah" },
      data: { displayName: "Sarah", reference: "002" }
    });
    expect(mocks.playerParticipantDeleteMany).not.toHaveBeenCalled();
  });

  it("preserves server eligibility and rejects client eligibility or settings fields", async () => {
    const { PUT } = await import("@/app/api/admin/player-draws/[id]/participants/route");
    const safeResponse = await PUT(participantRequest({
      revision: baseDraw.updatedAt.toISOString(),
      participants: participants.map(({ id, displayName, reference }) => ({ id, displayName, reference }))
    }), { params: Promise.resolve({ id: "player-draw-1" }) });

    expect(safeResponse.status).toBe(200);
    expect(mocks.playerParticipantUpdate).toHaveBeenCalledWith({
      where: { id: "participant-david" },
      data: { displayName: "David", reference: "003" }
    });
    expect(mocks.playerParticipantUpdate).not.toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ isEligible: expect.anything() })
    }));

    const invalidResponse = await PUT(participantRequest({
      revision: baseDraw.updatedAt.toISOString(),
      mode: "RANDOM",
      participants: [{ id: "participant-david", displayName: "David", reference: "003", isEligible: true }]
    }), { params: Promise.resolve({ id: "player-draw-1" }) });

    expect(invalidResponse.status).toBe(400);
    expect(mocks.playerDrawUpdate).not.toHaveBeenCalled();
  });

  it("rejects stale participant writes without replacing a newer list", async () => {
    mocks.playerDrawFindUnique.mockResolvedValue({
      ...baseDraw,
      updatedAt: new Date("2026-08-21T00:10:00.000Z")
    });
    const { PUT } = await import("@/app/api/admin/player-draws/[id]/participants/route");
    const response = await PUT(participantRequest({
      revision: baseDraw.updatedAt.toISOString(),
      participants: [{ id: "participant-ali", displayName: "Ali", reference: "001" }]
    }), { params: Promise.resolve({ id: "player-draw-1" }) });
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toBe("Player list changed on another device. Refresh and try again.");
    expect(body.participants.map((participant: { id: string }) => participant.id)).toEqual(
      participants.map((participant) => participant.id),
    );
    expect(body.revision).toBe("2026-08-21T00:10:00.000Z");
    expect(mocks.playerDrawUpdateMany).not.toHaveBeenCalled();
    expect(mocks.playerParticipantDeleteMany).not.toHaveBeenCalled();
  });

  it("does not clear an armed winner when participant membership is edited", async () => {
    const { PUT } = await import("@/app/api/admin/player-draws/[id]/participants/route");
    const response = await PUT(participantRequest({
      revision: baseDraw.updatedAt.toISOString(),
      participants: participants
        .filter((participant) => participant.id !== "participant-sarah")
        .map(({ id, displayName, reference }) => ({ id, displayName, reference }))
    }), { params: Promise.resolve({ id: "player-draw-1" }) });

    expect(response.status).toBe(400);
    expect(mocks.playerParticipantDeleteMany).not.toHaveBeenCalled();
    expect(mocks.playerDrawUpdate).not.toHaveBeenCalled();
  });

  it("does not allow an unauthenticated viewer to create a private player result or remove a winner", async () => {
    mocks.getAdminFromRequest.mockResolvedValue(null);
    mocks.playerDrawFindUnique.mockResolvedValue({ ...baseDraw, removeWinnerAfterWin: true });
    const { POST } = await import("@/app/api/player-draw/[publicCode]/spin/route");

    const response = await POST(audienceRequest(), { params: Promise.resolve({ publicCode: "PLAYTEST" }) });

    expect(response.status).toBe(401);
    expect(mocks.playerDrawResultCreate).not.toHaveBeenCalled();
    expect(mocks.playerParticipantUpdate).not.toHaveBeenCalled();
  });

  it("admin can set a next operator participant", async () => {
    const { PUT } = await import("@/app/api/admin/player-draws/[id]/route");
    const response = await PUT(adminRequest(adminPayload({ nextWinnerParticipantId: "participant-sarah", action: "set" })), {
      params: Promise.resolve({ id: "player-draw-1" })
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.draw.pendingOperatorParticipantId).toBe("participant-sarah");
    expect(mocks.auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "PLAYER_DRAW_UPDATED", adminUserId: "admin-1", success: true })
      })
    );
    expect(mocks.playerParticipantFindFirst).toHaveBeenCalledWith({
      where: { id: "participant-sarah", playerDrawId: "player-draw-1", isEligible: true }
    });
  });

  it("excluded operator participant is rejected", async () => {
    const { PUT } = await import("@/app/api/admin/player-draws/[id]/route");
    const response = await PUT(adminRequest(adminPayload({ nextWinnerParticipantId: "participant-david", action: "set" })), {
      params: Promise.resolve({ id: "player-draw-1" })
    });

    expect(response.status).toBe(400);
  });

  it("pending operator participant is not exposed publicly", async () => {
    const { getPlayerDrawAudience } = await import("@/lib/player-draws");
    mocks.playerDrawFindUnique.mockResolvedValue({ ...baseDraw, showParticipantList: false });
    const draw = await getPlayerDrawAudience("PLAYTEST");

    expect(draw?.label).toBe("OPERATOR DRAW");
    expect(draw?.participants).toEqual([]);
    expect(JSON.stringify(draw)).not.toContain("pendingOperatorParticipantId");
    expect(JSON.stringify(draw)).not.toContain("participant-sarah");
  });

  it("visible private participant list uses safe public IDs and allowed references", async () => {
    const { getPlayerDrawAudience } = await import("@/lib/player-draws");
    mocks.playerDrawFindUnique.mockResolvedValue(baseDraw);
    const draw = await getPlayerDrawAudience("PLAYTEST");

    expect(draw?.participants).toEqual([
      { id: "player-1", displayName: "Ali", reference: "001", isEligible: true },
      { id: "player-2", displayName: "Sarah", reference: "002", isEligible: true },
      { id: "player-3", displayName: "David", reference: "003", isEligible: false }
    ]);
    expect(JSON.stringify(draw)).not.toContain("participant-ali");
    expect(JSON.stringify(draw)).not.toContain("participant-sarah");
    expect(JSON.stringify(draw)).not.toContain("participant-david");
  });

  it("audience cannot force a player winner through request body", async () => {
    const { POST } = await import("@/app/api/player-draw/[publicCode]/spin/route");
    const response = await POST(audienceRequest({ winner: "David", winnerId: "participant-david", nextWinner: "participant-david" }), {
      params: Promise.resolve({ publicCode: "PLAYTEST" })
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.displayName).toBe("Sarah");
    expect(body.participantId).toBe("participant-sarah");
    expect(JSON.stringify(body)).not.toContain("pendingOperatorParticipantId");
    expect(mocks.rateLimit).toHaveBeenCalledWith("player-draw:PLAYTEST:local-development", expect.any(Number), 60_000, {
      allowOnInfrastructureFailure: true,
      endpoint: "private player spin"
    });
  });

  it("operator participant is consumed once and not reused", async () => {
    const { POST } = await import("@/app/api/player-draw/[publicCode]/spin/route");
    mocks.playerDrawFindUnique
      .mockResolvedValueOnce(baseDraw)
      .mockResolvedValueOnce({ ...baseDraw, pendingOperatorParticipantId: null });

    const first = await POST(audienceRequest(), { params: Promise.resolve({ publicCode: "PLAYTEST" }) });
    const second = await POST(audienceRequest(), { params: Promise.resolve({ publicCode: "PLAYTEST" }) });

    expect(first.status).toBe(200);
    expect(second.status).toBe(400);
    expect(mocks.playerDrawResultCreate).toHaveBeenCalledTimes(1);
    expect(mocks.playerDrawUpdateMany).toHaveBeenCalledWith({
      where: { id: "player-draw-1", pendingOperatorParticipantId: "participant-sarah" },
      data: { pendingOperatorParticipantId: null }
    });
  });

  it("archived player audience draw cannot be used normally", async () => {
    const { POST } = await import("@/app/api/player-draw/[publicCode]/spin/route");
    mocks.playerDrawFindUnique.mockResolvedValue({ ...baseDraw, isActive: false, archivedAt: new Date("2026-08-22T00:00:00.000Z") });

    const response = await POST(audienceRequest(), { params: Promise.resolve({ publicCode: "PLAYTEST" }) });

    expect(response.status).toBe(404);
    expect(mocks.playerDrawResultCreate).not.toHaveBeenCalled();
  });

  it("inactive player draw can be archived", async () => {
    const archivedAt = new Date("2026-08-22T00:00:00.000Z");
    mocks.playerDrawFindUnique.mockResolvedValue({ ...baseDraw, isActive: false });
    mocks.playerDrawUpdate.mockResolvedValue({ ...baseDraw, isActive: false, pendingOperatorParticipantId: null, archivedAt });
    const { PATCH } = await import("@/app/api/admin/player-draws/[id]/route");
    const response = await PATCH(
      new NextRequest("http://localhost:3000/api/admin/player-draws/player-draw-1", {
        method: "PATCH",
        body: JSON.stringify({ action: "archive" }),
        headers: { "content-type": "application/json", origin: "http://localhost:3000" }
      }),
      { params: Promise.resolve({ id: "player-draw-1" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.message).toBe("Player draw archived successfully.");
    expect(mocks.playerDrawUpdate).toHaveBeenCalledWith({
      where: { id: "player-draw-1" },
      data: expect.objectContaining({ isActive: false, pendingOperatorParticipantId: null, archivedAt: expect.any(Date) })
    });
  });

  it("archived player draw can be restored", async () => {
    mocks.playerDrawFindUnique.mockResolvedValue({ ...baseDraw, isActive: false, archivedAt: new Date("2026-08-22T00:00:00.000Z") });
    mocks.playerDrawUpdate.mockResolvedValue({ ...baseDraw, isActive: false, archivedAt: null });
    const { PATCH } = await import("@/app/api/admin/player-draws/[id]/route");
    const response = await PATCH(
      new NextRequest("http://localhost:3000/api/admin/player-draws/player-draw-1", {
        method: "PATCH",
        body: JSON.stringify({ action: "restore" }),
        headers: { "content-type": "application/json", origin: "http://localhost:3000" }
      }),
      { params: Promise.resolve({ id: "player-draw-1" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.message).toBe("Player draw restored successfully.");
    expect(body.draw.archivedAt).toBeNull();
    expect(body.draw.isActive).toBe(false);
  });

  it("archived player draw can be permanently deleted without touching another draw", async () => {
    mocks.playerDrawFindUnique.mockResolvedValue({ ...baseDraw, archivedAt: new Date("2026-08-22T00:00:00.000Z") });
    const { DELETE } = await import("@/app/api/admin/player-draws/[id]/route");
    const response = await DELETE(
      new NextRequest("http://localhost:3000/api/admin/player-draws/player-draw-1", {
        method: "DELETE",
        body: JSON.stringify({ confirmation: "PERMANENTLY DELETE" }),
        headers: { "content-type": "application/json", origin: "http://localhost:3000" }
      }),
      { params: Promise.resolve({ id: "player-draw-1" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ deletedId: "player-draw-1", message: "Player draw permanently deleted." });
    expect(mocks.playerDrawDelete).toHaveBeenCalledWith({ where: { id: "player-draw-1" } });
    expect(mocks.playerDrawDelete).not.toHaveBeenCalledWith({ where: { id: "player-draw-2" } });
  });

  it("concurrency consumes a pending operator participant only once", async () => {
    const { POST } = await import("@/app/api/player-draw/[publicCode]/spin/route");
    mocks.playerDrawUpdateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });

    const first = await POST(audienceRequest(), { params: Promise.resolve({ publicCode: "PLAYTEST" }) });
    const second = await POST(audienceRequest(), { params: Promise.resolve({ publicCode: "PLAYTEST" }) });

    expect(first.status).toBe(200);
    expect(second.status).toBe(400);
    expect(mocks.playerDrawResultCreate).toHaveBeenCalledTimes(1);
  });

  it("winner history and remove-winner policy happen inside the draw transaction", async () => {
    const { POST } = await import("@/app/api/player-draw/[publicCode]/spin/route");
    mocks.playerDrawFindUnique.mockResolvedValue({ ...baseDraw, removeWinnerAfterWin: true });

    const response = await POST(audienceRequest(), { params: Promise.resolve({ publicCode: "PLAYTEST" }) });

    expect(response.status).toBe(200);
    expect(mocks.transaction).toHaveBeenCalled();
    expect(mocks.playerDrawResultCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        displayNameSnapshot: "Sarah",
        referenceSnapshot: "002",
        mode: "OPERATOR"
      })
    });
    expect(mocks.playerParticipantUpdate).toHaveBeenCalledWith({
      where: { id: "participant-sarah" },
      data: { isEligible: false }
    });
  });

  it("random player draw uses secure server selection and not Math.random", async () => {
    const randomSpy = vi.spyOn(Math, "random");
    const { createPublicPlayerSpin, generatePlayerDrawPublicCode } = await import("@/lib/player-draws");

    const result = await createPublicPlayerSpin({
      participants: [
        { id: "a", displayName: "Ali", isEligible: true },
        { id: "s", displayName: "Sarah", isEligible: false }
      ]
    });
    const code = generatePlayerDrawPublicCode();

    expect(result.displayName).toBe("Ali");
    expect(code).toMatch(/^PLAY[A-HJ-NP-Z2-9]{4}$/);
    expect(code).not.toMatch(/[O0I1]/);
    expect(randomSpy).not.toHaveBeenCalled();
    randomSpy.mockRestore();
  });

  it("/api/player-spin returns a safe 429 when rate limited", async () => {
    mocks.rateLimit.mockResolvedValue({ allowed: false });
    const { POST } = await import("@/app/api/player-spin/route");
    const response = await POST(publicPlayerRequest({ winner: "Ali", participants: [{ id: "ali", displayName: "Ali" }] }));
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body).toEqual({ error: "Too many requests. Please try again shortly." });
    expect(JSON.stringify(body)).not.toContain("SPIN_RATE_LIMIT_PER_MINUTE");
  });

  it("/api/player-spin still works normally and rate limiting does not alter winner selection", async () => {
    mocks.rateLimit.mockResolvedValue({ allowed: true });
    const { POST } = await import("@/app/api/player-spin/route");
    const response = await POST(
      publicPlayerRequest({
        winner: "Mallory",
        forcedWinner: "Mallory",
        participants: [
          { id: "ali", displayName: "Ali", isEligible: true },
          { id: "sarah", displayName: "Sarah", isEligible: false }
        ]
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.displayName).toBe("Ali");
    expect(body.participantId).toBe("ali");
    expect(mocks.rateLimit).toHaveBeenCalledWith("player-spin:local-development", expect.any(Number), 60_000, {
      allowOnInfrastructureFailure: true,
      endpoint: "public player spin"
    });
  });

  it("duplicate names remain separate normalized participants", async () => {
    const { normalizePlayerParticipants } = await import("@/lib/player-draws");
    const normalized = normalizePlayerParticipants([
      { id: "james-001", displayName: "James Lee", reference: "001" },
      { id: "james-032", displayName: "James Lee", reference: "032" },
      { id: "james-048", displayName: "James Lee", reference: "048" }
    ]);

    expect(normalized).toHaveLength(3);
    expect(normalized.map((participant) => participant.id)).toEqual(["james-001", "james-032", "james-048"]);
    expect(new Set(normalized.map((participant) => participant.id)).size).toBe(3);
  });

  it("CSV import trims rows and export protects formula injection", async () => {
    const { parseParticipantCsv, exportParticipantsCsv } = await import("@/lib/player-draws");
    const imported = parseParticipantCsv("Name,Reference\n Sarah Lee ,002\n=Bad,@ref\n\n");
    const exported = exportParticipantsCsv(imported);

    expect(imported).toEqual([
      { displayName: "Sarah Lee", reference: "002", isEligible: true },
      { displayName: "=Bad", reference: "@ref", isEligible: true }
    ]);
    expect(exported).toContain("\"'=Bad\"");
    expect(exported).toContain("\"'@ref\"");
  });

  it("RandomSpin number draw tables are not used by Player Draw APIs", async () => {
    const { POST } = await import("@/app/api/player-draw/[publicCode]/spin/route");

    await POST(audienceRequest(), { params: Promise.resolve({ publicCode: "PLAYTEST" }) });

    expect(mocks.playerDrawFindUnique).toHaveBeenCalled();
    expect(mocks.playerDrawResultCreate).toHaveBeenCalled();
  });
});
