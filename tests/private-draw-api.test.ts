import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  getAdminFromRequest: vi.fn(),
  rateLimit: vi.fn(),
  privateDrawFindMany: vi.fn(),
  privateDrawFindFirst: vi.fn(),
  privateDrawFindUnique: vi.fn(),
  privateDrawCreate: vi.fn(),
  privateDrawUpdate: vi.fn(),
  privateDrawUpdateMany: vi.fn(),
  privateDrawDelete: vi.fn(),
  privateDrawSpinCreate: vi.fn(),
  auditCreate: vi.fn(),
  auditFindFirst: vi.fn(),
  transaction: vi.fn()
}));

vi.mock("@/lib/auth", () => ({ getAdminFromRequest: mocks.getAdminFromRequest }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: mocks.rateLimit }));
vi.mock("@/lib/db", () => ({
  prisma: {
    privateDraw: {
      findMany: mocks.privateDrawFindMany,
      findFirst: mocks.privateDrawFindFirst,
      findUnique: mocks.privateDrawFindUnique,
      create: mocks.privateDrawCreate,
      update: mocks.privateDrawUpdate,
      updateMany: mocks.privateDrawUpdateMany,
      delete: mocks.privateDrawDelete
    },
    privateDrawSpinResult: { create: mocks.privateDrawSpinCreate },
    auditLog: { create: mocks.auditCreate, findFirst: mocks.auditFindFirst },
    $transaction: mocks.transaction
  }
}));

const baseDraw = {
  id: "draw-1",
  publicCode: "A7K29P",
  liveSlug: null,
  name: "Event Draw",
  minNumber: 1,
  maxNumber: 10,
  excludedNumbers: [2, 4, 6, 8, 10],
  mode: "OPERATOR",
  displayStyle: "WHEEL",
  pendingOperatorWinner: 7,
  isActive: true,
  archivedAt: null,
  createdAt: new Date("2026-08-21T00:00:00.000Z"),
  updatedAt: new Date("2026-08-21T00:00:00.000Z")
};

describe("private draw operator mode APIs", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getAdminFromRequest.mockResolvedValue({ id: "admin-1", email: "admin@luckyspin.local" });
    mocks.rateLimit.mockResolvedValue({ allowed: true });
    mocks.privateDrawFindMany.mockResolvedValue([{ ...baseDraw, _count: { spinResults: 0 } }]);
    mocks.privateDrawFindUnique.mockResolvedValue(baseDraw);
    mocks.privateDrawFindFirst.mockImplementation((args) => mocks.privateDrawFindUnique(args));
    mocks.privateDrawCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      ...baseDraw,
      id: "draw-created",
      ...data,
      createdAt: new Date("2026-08-21T00:00:00.000Z"),
      updatedAt: new Date("2026-08-21T00:00:00.000Z")
    }));
    mocks.privateDrawUpdate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ ...baseDraw, ...data }));
    mocks.privateDrawUpdateMany.mockResolvedValue({ count: 1 });
    mocks.privateDrawDelete.mockResolvedValue(baseDraw);
    mocks.auditCreate.mockResolvedValue({});
    mocks.auditFindFirst.mockResolvedValue(null);
    mocks.privateDrawSpinCreate.mockResolvedValue({
      id: "draw-spin-1",
      winningNumber: 7,
      createdAt: new Date("2026-08-21T01:02:03.000Z")
    });
    mocks.transaction.mockImplementation(async (callback) =>
      callback({
        privateDraw: {
          findFirst: mocks.privateDrawFindFirst,
          findUnique: mocks.privateDrawFindUnique,
          updateMany: mocks.privateDrawUpdateMany
        },
        privateDrawSpinResult: { create: mocks.privateDrawSpinCreate }
      })
    );
  });

  function adminRequest(body: unknown, origin = "http://localhost:3000") {
    return new NextRequest("http://localhost:3000/api/admin/draws/draw-1", {
      method: "PUT",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json", origin }
    });
  }

  function adminPayload(overrides: Record<string, unknown> = {}) {
    return {
      name: baseDraw.name,
      minNumber: baseDraw.minNumber,
      maxNumber: baseDraw.maxNumber,
      excludedNumbers: baseDraw.excludedNumbers,
      mode: baseDraw.mode,
      displayStyle: baseDraw.displayStyle,
      isActive: baseDraw.isActive,
      ...overrides
    };
  }

  function audienceRequest(body: unknown = {}) {
    return new NextRequest("http://localhost:3000/api/draw/A7K29P/spin", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json", origin: "http://localhost:3000" }
    });
  }

  function liveRangeRequest(body: unknown, origin = "http://localhost:3000") {
    return new NextRequest("http://localhost:3000/api/draw/A7K29P/range", {
      method: "PATCH",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json", origin }
    });
  }

  it("operator mode requires admin authentication", async () => {
    mocks.getAdminFromRequest.mockResolvedValue(null);
    const { PUT } = await import("@/app/api/admin/draws/[id]/route");
    const response = await PUT(adminRequest(adminPayload({ nextWinner: 7 })), {
      params: Promise.resolve({ id: "draw-1" })
    });

    expect(response.status).toBe(401);
    expect(mocks.privateDrawUpdate).not.toHaveBeenCalled();
  });

  it("does not allow an unauthenticated viewer to create a private number result", async () => {
    mocks.getAdminFromRequest.mockResolvedValue(null);
    const { POST } = await import("@/app/api/draw/[publicCode]/spin/route");

    const response = await POST(audienceRequest(), { params: Promise.resolve({ publicCode: "A7K29P" }) });

    expect(response.status).toBe(401);
    expect(mocks.privateDrawSpinCreate).not.toHaveBeenCalled();
    expect(mocks.privateDrawUpdateMany).not.toHaveBeenCalled();
  });

  it("rejects a private number spin from another origin", async () => {
    const { POST } = await import("@/app/api/draw/[publicCode]/spin/route");
    const request = new NextRequest("http://localhost:3000/api/draw/A7K29P/spin", {
      method: "POST",
      body: "{}",
      headers: { "content-type": "application/json", origin: "https://attacker.example" }
    });

    const response = await POST(request, { params: Promise.resolve({ publicCode: "A7K29P" }) });

    expect(response.status).toBe(403);
    expect(mocks.privateDrawSpinCreate).not.toHaveBeenCalled();
  });

  it("admin can set a valid next confirmed number", async () => {
    mocks.privateDrawFindUnique.mockResolvedValue({ ...baseDraw, minNumber: 1, maxNumber: 30, excludedNumbers: [3, 9, 13, 18] });
    const { PUT } = await import("@/app/api/admin/draws/[id]/route");
    const response = await PUT(adminRequest(adminPayload({ minNumber: 1, maxNumber: 30, excludedNumbers: [3, 9, 13, 18], nextWinner: 20, action: "set" })), {
      params: Promise.resolve({ id: "draw-1" })
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.draw.pendingOperatorWinner).toBe(20);
    expect(mocks.auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "PRIVATE_DRAW_UPDATED", adminUserId: "admin-1", success: true })
      })
    );
    expect(mocks.privateDrawUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ mode: "OPERATOR", pendingOperatorWinner: 20 })
      })
    );
  });

  it("ignores a stale next winner on an unrelated exclusion save after that winner was consumed", async () => {
    const consumedDraw = { ...baseDraw, pendingOperatorWinner: null, excludedNumbers: [2, 4, 6, 8, 10] };
    mocks.privateDrawFindUnique.mockResolvedValue(consumedDraw);
    mocks.privateDrawUpdate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ ...consumedDraw, ...data }));
    const { PUT } = await import("@/app/api/admin/draws/[id]/route");

    const response = await PUT(
      adminRequest(adminPayload({ excludedNumbers: [2, 3, 4, 6, 8, 10], nextWinner: 7 })),
      { params: Promise.resolve({ id: "draw-1" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.draw.pendingOperatorWinner).toBeNull();
    expect(mocks.privateDrawUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ pendingOperatorWinner: null, excludedNumbers: "[2,3,4,6,8,10]" }) })
    );
  });

  it("admin can set a normalized friendly live URL", async () => {
    mocks.privateDrawFindFirst.mockResolvedValue(null);
    const { PUT } = await import("@/app/api/admin/draws/[id]/route");

    const response = await PUT(adminRequest(adminPayload({ liveSlug: " Friday-Draw " })), {
      params: Promise.resolve({ id: "draw-1" })
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.draw.liveSlug).toBe("friday-draw");
    expect(mocks.privateDrawUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ liveSlug: "friday-draw" })
      })
    );
  });

  it("rejects duplicate friendly live URLs", async () => {
    mocks.privateDrawFindFirst.mockResolvedValue({ id: "other-draw" });
    const { PUT } = await import("@/app/api/admin/draws/[id]/route");

    const response = await PUT(adminRequest(adminPayload({ liveSlug: "friday" })), {
      params: Promise.resolve({ id: "draw-1" })
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("That live URL is already in use.");
    expect(mocks.privateDrawUpdate).not.toHaveBeenCalled();
  });

  it("rejects invalid friendly live URL characters", async () => {
    const { PUT } = await import("@/app/api/admin/draws/[id]/route");

    const response = await PUT(adminRequest(adminPayload({ liveSlug: "Friday Draw!" })), {
      params: Promise.resolve({ id: "draw-1" })
    });

    expect(response.status).toBe(400);
    expect(mocks.privateDrawUpdate).not.toHaveBeenCalled();
  });

  it("rejects a next confirmed number outside the current range", async () => {
    const { PUT } = await import("@/app/api/admin/draws/[id]/route");

    const response = await PUT(adminRequest(adminPayload({ nextWinner: 11, action: "set" })), {
      params: Promise.resolve({ id: "draw-1" })
    });

    expect(response.status).toBe(400);
  });

  it("rejects an excluded next confirmed number", async () => {
    mocks.privateDrawFindUnique.mockResolvedValue({ ...baseDraw, minNumber: 1, maxNumber: 30, excludedNumbers: [3, 9, 13, 18] });
    const { PUT } = await import("@/app/api/admin/draws/[id]/route");

    const response = await PUT(adminRequest(adminPayload({ minNumber: 1, maxNumber: 30, excludedNumbers: [3, 9, 13, 18], nextWinner: 18, action: "set" })), {
      params: Promise.resolve({ id: "draw-1" })
    });

    expect(response.status).toBe(400);
  });

  it("rejects decimal and non-integer next confirmed numbers", async () => {
    const { PUT } = await import("@/app/api/admin/draws/[id]/route");

    const decimal = await PUT(adminRequest(adminPayload({ nextWinner: 7.5, action: "set" })), {
      params: Promise.resolve({ id: "draw-1" })
    });
    const nonInteger = await PUT(adminRequest(adminPayload({ nextWinner: "not-a-number", action: "set" })), {
      params: Promise.resolve({ id: "draw-1" })
    });

    expect(decimal.status).toBe(400);
    expect(nonInteger.status).toBe(400);
  });

  it("admin can create a private draw with a generated public code", async () => {
    const { POST } = await import("@/app/api/admin/draws/route");
    const response = await POST(
      new NextRequest("http://localhost:3000/api/admin/draws", {
        method: "POST",
        body: JSON.stringify({
          name: "Saturday Event",
          minNumber: 1,
          maxNumber: 30,
          excludedNumbers: [],
          mode: "RANDOM",
          displayStyle: "NUMBER_ROLLER",
          isActive: true
        }),
        headers: { "content-type": "application/json", origin: "http://localhost:3000" }
      })
    );
    const body = await response.json();
    const publicCode = mocks.privateDrawCreate.mock.calls[0][0].data.publicCode as string;

    expect(response.status).toBe(201);
    expect(body.draw.publicCode).toBe(publicCode);
    expect(publicCode).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
    expect(publicCode).not.toMatch(/[O0I1]/);
  });

  it("private draw creation requires admin authentication", async () => {
    mocks.getAdminFromRequest.mockResolvedValue(null);
    const { POST } = await import("@/app/api/admin/draws/route");
    const response = await POST(
      new NextRequest("http://localhost:3000/api/admin/draws", {
        method: "POST",
        body: JSON.stringify({ name: "Nope", minNumber: 1, maxNumber: 30, mode: "RANDOM", isActive: true }),
        headers: { "content-type": "application/json", origin: "http://localhost:3000" }
      })
    );

    expect(response.status).toBe(401);
    expect(mocks.privateDrawCreate).not.toHaveBeenCalled();
  });

  it("public code alone cannot modify draw settings", async () => {
    mocks.getAdminFromRequest.mockResolvedValue(null);
    const { PUT } = await import("@/app/api/admin/draws/[id]/route");
    const response = await PUT(adminRequest(adminPayload({ isActive: false })), {
      params: Promise.resolve({ id: "draw-1" })
    });

    expect(response.status).toBe(401);
    expect(mocks.privateDrawUpdate).not.toHaveBeenCalled();
  });

  it("backend admin save cannot overwrite an active live range from a stale form", async () => {
    const liveDraw = { ...baseDraw, minNumber: 1, maxNumber: 19, excludedNumbers: [3, 9], mode: "RANDOM", pendingOperatorWinner: null };
    mocks.privateDrawFindUnique.mockResolvedValue(liveDraw);
    mocks.privateDrawUpdate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ ...liveDraw, ...data }));
    const { PUT } = await import("@/app/api/admin/draws/[id]/route");
    const response = await PUT(
      adminRequest({
        ...adminPayload({
          minNumber: 1,
          maxNumber: 20,
          excludedText: "3,9,14",
          mode: "RANDOM",
          nextWinner: undefined
        })
      }),
      { params: Promise.resolve({ id: "draw-1" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.draw).toEqual(expect.objectContaining({ minNumber: 1, maxNumber: 19, excludedNumbers: [3, 9, 14] }));
    expect(mocks.privateDrawUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          minNumber: 1,
          maxNumber: 19,
          excludedNumbers: "[3,9,14]"
        })
      })
    );
    expect(mocks.privateDrawUpdate).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ maxNumber: 20 })
      })
    );
  });

  it("inactive backend admin save can configure the starting range before activation", async () => {
    const inactiveDraw = { ...baseDraw, isActive: false, minNumber: 1, maxNumber: 20, mode: "RANDOM", pendingOperatorWinner: null, excludedNumbers: [] };
    mocks.privateDrawFindUnique.mockResolvedValue(inactiveDraw);
    mocks.privateDrawUpdate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ ...inactiveDraw, ...data }));
    const { PUT } = await import("@/app/api/admin/draws/[id]/route");
    const response = await PUT(
      adminRequest({
        ...adminPayload({
          minNumber: 1,
          maxNumber: 18,
          excludedNumbers: [],
          mode: "RANDOM",
          isActive: true,
          nextWinner: undefined
        })
      }),
      { params: Promise.resolve({ id: "draw-1" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.draw).toEqual(expect.objectContaining({ minNumber: 1, maxNumber: 18, isActive: true }));
    expect(mocks.privateDrawUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ minNumber: 1, maxNumber: 18, isActive: true })
      })
    );
  });

  it("backend live control can undo the last exclusion change without changing active range", async () => {
    const activeDraw = { ...baseDraw, minNumber: 1, maxNumber: 19, excludedNumbers: [3, 9, 8], mode: "RANDOM", pendingOperatorWinner: null };
    mocks.privateDrawFindUnique.mockResolvedValue(activeDraw);
    mocks.privateDrawUpdate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ ...activeDraw, ...data }));
    mocks.auditFindFirst.mockResolvedValue({
      metadata: {
        before: [3, 9],
        after: [3, 8, 9]
      }
    });
    const { PATCH } = await import("@/app/api/admin/draws/[id]/route");
    const response = await PATCH(
      new NextRequest("http://localhost:3000/api/admin/draws/draw-1", {
        method: "PATCH",
        body: JSON.stringify({ action: "undo-exclusion" }),
        headers: { "content-type": "application/json", origin: "http://localhost:3000" }
      }),
      { params: Promise.resolve({ id: "draw-1" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.draw).toEqual(expect.objectContaining({ minNumber: 1, maxNumber: 19, excludedNumbers: [3, 9] }));
    expect(mocks.auditFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ action: "PRIVATE_DRAW_EXCLUSIONS_UPDATED", target: "PrivateDraw:draw-1" })
      })
    );
    expect(mocks.privateDrawUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ minNumber: 1, maxNumber: 19 })
      })
    );
  });

  it("late next winner commit applies only to the following spin", async () => {
    const { PUT } = await import("@/app/api/admin/draws/[id]/route");
    const { POST } = await import("@/app/api/draw/[publicCode]/spin/route");
    let resolveSetNext: () => void = () => {
      throw new Error("Set Next request did not start.");
    };
    let currentDraw = {
      ...baseDraw,
      minNumber: 1,
      maxNumber: 20,
      mode: "OPERATOR",
      pendingOperatorWinner: null,
      excludedNumbers: Array.from({ length: 20 }, (_, index) => index + 1).filter((value) => value !== 4)
    };

    mocks.privateDrawFindUnique.mockImplementation(async () => currentDraw);
    mocks.privateDrawUpdate.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) =>
        new Promise((resolve) => {
          resolveSetNext = () => {
            currentDraw = {
              ...currentDraw,
              ...data,
              excludedNumbers: Array.isArray(data.excludedNumbers) ? data.excludedNumbers : JSON.parse(String(data.excludedNumbers ?? "[]"))
            };
            resolve(currentDraw);
          };
        })
    );
    mocks.privateDrawUpdateMany.mockImplementation(async ({ where, data }: { where: { pendingOperatorWinner?: number }; data: { pendingOperatorWinner?: null } }) => {
      if (where.pendingOperatorWinner === currentDraw.pendingOperatorWinner) {
        currentDraw = { ...currentDraw, pendingOperatorWinner: data.pendingOperatorWinner ?? null };
        return { count: 1 };
      }

      return { count: 0 };
    });
    mocks.privateDrawSpinCreate.mockImplementation(async ({ data }: { data: { winningNumber: number; mode: string } }) => ({
      id: `draw-spin-${data.winningNumber}-${data.mode}`,
      winningNumber: data.winningNumber,
      createdAt: new Date("2026-08-21T01:02:03.000Z")
    }));

    const setNextPromise = PUT(
      adminRequest(
        adminPayload({
          minNumber: 1,
          maxNumber: 20,
          excludedNumbers: Array.from({ length: 20 }, (_, index) => index + 1).filter((value) => value !== 4 && value !== 15),
          mode: "OPERATOR",
          nextWinner: 15,
          action: "set"
        })
      ),
      { params: Promise.resolve({ id: "draw-1" }) }
    );
    const firstSpin = await POST(audienceRequest(), { params: Promise.resolve({ publicCode: "A7K29P" }) });
    const firstBody = await firstSpin.json();

    expect(firstBody).toEqual(expect.objectContaining({ winner: 4, mode: "RANDOM" }));

    resolveSetNext?.();
    const setNext = await setNextPromise;
    expect(setNext.status).toBe(200);
    expect(currentDraw.pendingOperatorWinner).toBe(15);

    const secondSpin = await POST(audienceRequest(), { params: Promise.resolve({ publicCode: "A7K29P" }) });
    const secondBody = await secondSpin.json();
    expect(secondBody).toEqual(expect.objectContaining({ winner: 15, mode: "OPERATOR" }));
    expect(currentDraw.pendingOperatorWinner).toBeNull();

    const thirdSpin = await POST(audienceRequest(), { params: Promise.resolve({ publicCode: "A7K29P" }) });
    const thirdBody = await thirdSpin.json();
    expect(thirdBody.mode).toBe("RANDOM");
  });

  it("late exclusion commit applies only to future random spins", async () => {
    const { PUT } = await import("@/app/api/admin/draws/[id]/route");
    const { POST } = await import("@/app/api/draw/[publicCode]/spin/route");
    let resolveExclusionSave: () => void = () => {
      throw new Error("Exclusion save request did not start.");
    };
    let currentDraw = {
      ...baseDraw,
      minNumber: 1,
      maxNumber: 20,
      mode: "RANDOM",
      pendingOperatorWinner: null,
      excludedNumbers: Array.from({ length: 20 }, (_, index) => index + 1).filter((value) => value !== 8)
    };

    mocks.privateDrawFindUnique.mockImplementation(async () => currentDraw);
    mocks.privateDrawUpdate.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) =>
        new Promise((resolve) => {
          resolveExclusionSave = () => {
            currentDraw = {
              ...currentDraw,
              ...data,
              excludedNumbers: Array.isArray(data.excludedNumbers) ? data.excludedNumbers : JSON.parse(String(data.excludedNumbers ?? "[]"))
            };
            resolve(currentDraw);
          };
        })
    );
    mocks.privateDrawSpinCreate.mockImplementation(async ({ data }: { data: { winningNumber: number; mode: string } }) => ({
      id: `draw-spin-${data.winningNumber}-${data.mode}`,
      winningNumber: data.winningNumber,
      createdAt: new Date("2026-08-21T01:02:03.000Z")
    }));

    const saveExclusionPromise = PUT(
      adminRequest(
        adminPayload({
          minNumber: 1,
          maxNumber: 20,
          excludedNumbers: Array.from({ length: 20 }, (_, index) => index + 1).filter((value) => value !== 4),
          mode: "RANDOM",
          nextWinner: undefined
        })
      ),
      { params: Promise.resolve({ id: "draw-1" }) }
    );
    const firstSpin = await POST(audienceRequest(), { params: Promise.resolve({ publicCode: "A7K29P" }) });
    const firstBody = await firstSpin.json();

    expect(firstBody).toEqual(expect.objectContaining({ winner: 8, mode: "RANDOM" }));

    resolveExclusionSave?.();
    const saveExclusion = await saveExclusionPromise;
    expect(saveExclusion.status).toBe(200);

    const secondSpin = await POST(audienceRequest(), { params: Promise.resolve({ publicCode: "A7K29P" }) });
    const secondBody = await secondSpin.json();
    expect(secondBody).toEqual(expect.objectContaining({ winner: 4, mode: "RANDOM" }));
  });

  it("live range editing requires an authenticated admin session", async () => {
    mocks.getAdminFromRequest.mockResolvedValue(null);
    const { PATCH } = await import("@/app/api/draw/[publicCode]/range/route");
    const response = await PATCH(liveRangeRequest({ from: 1, to: 30, revision: baseDraw.updatedAt.toISOString() }), {
      params: Promise.resolve({ publicCode: "A7K29P" })
    });

    expect(response.status).toBe(401);
    expect(mocks.privateDrawUpdateMany).not.toHaveBeenCalled();
  });

  it("admin live range editing saves normalized values to the same private draw row", async () => {
    const { PATCH } = await import("@/app/api/draw/[publicCode]/range/route");
    const response = await PATCH(liveRangeRequest({ from: "01", to: "033", revision: baseDraw.updatedAt.toISOString() }), {
      params: Promise.resolve({ publicCode: "A7K29P" })
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(expect.objectContaining({ from: 1, to: 33, label: "OPERATOR DRAW", displayStyle: "WHEEL", revision: expect.any(String) }));
    expect(mocks.privateDrawUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "draw-1",
          isActive: true,
          archivedAt: null,
          updatedAt: baseDraw.updatedAt
        }),
        data: expect.objectContaining({ minNumber: 1, maxNumber: 33 })
      })
    );
  });

  it.each([100, 101, 250, 500, 1000])("admin live range editing accepts private 1-%i", async (to) => {
    const { PATCH } = await import("@/app/api/draw/[publicCode]/range/route");
    const response = await PATCH(liveRangeRequest({ from: 1, to, revision: baseDraw.updatedAt.toISOString() }), {
      params: Promise.resolve({ publicCode: "A7K29P" })
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(expect.objectContaining({ from: 1, to }));
    expect(mocks.privateDrawUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ minNumber: 1, maxNumber: to })
      })
    );
  });

  it("live range editing rejects invalid ranges without corrupting the draw", async () => {
    const { PATCH } = await import("@/app/api/draw/[publicCode]/range/route");
    const descending = await PATCH(liveRangeRequest({ from: 30, to: 1, revision: baseDraw.updatedAt.toISOString() }), {
      params: Promise.resolve({ publicCode: "A7K29P" })
    });
    const negative = await PATCH(liveRangeRequest({ from: -1, to: 30, revision: baseDraw.updatedAt.toISOString() }), {
      params: Promise.resolve({ publicCode: "A7K29P" })
    });

    expect(descending.status).toBe(400);
    expect(negative.status).toBe(400);
    expect(mocks.privateDrawUpdateMany).not.toHaveBeenCalled();
  });

  it("live range editing rejects private 1-1001 clearly without clamping", async () => {
    const { PATCH } = await import("@/app/api/draw/[publicCode]/range/route");
    const response = await PATCH(liveRangeRequest({ from: 1, to: 1001, revision: baseDraw.updatedAt.toISOString() }), {
      params: Promise.resolve({ publicCode: "A7K29P" })
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Maximum supported number is 1,000.");
    expect(mocks.privateDrawUpdateMany).not.toHaveBeenCalled();
  });

  it("stale live range revisions cannot overwrite a newer saved range", async () => {
    const currentRevision = new Date("2026-08-21T00:01:00.000Z");
    mocks.privateDrawUpdateMany.mockResolvedValue({ count: 0 });
    mocks.privateDrawFindUnique.mockResolvedValue({ ...baseDraw, minNumber: 1, maxNumber: 30, updatedAt: currentRevision });
    const { PATCH } = await import("@/app/api/draw/[publicCode]/range/route");
    const response = await PATCH(liveRangeRequest({ from: 1, to: 33, revision: baseDraw.updatedAt.toISOString() }), {
      params: Promise.resolve({ publicCode: "A7K29P" })
    });
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toEqual(
      expect.objectContaining({
        error: "Live draw range changed. Please review the current range and try again.",
        current: expect.objectContaining({ from: 1, to: 30, revision: currentRevision.toISOString() })
      })
    );
  });

  it("live range save is reflected by the admin draw page API and the next spin", async () => {
    const { PATCH: livePatch } = await import("@/app/api/draw/[publicCode]/range/route");
    const { GET: adminGet } = await import("@/app/api/admin/draws/[id]/route");
    const { POST: spinPost } = await import("@/app/api/draw/[publicCode]/spin/route");
    let currentDraw = {
      ...baseDraw,
      minNumber: 1,
      maxNumber: 33,
      mode: "RANDOM",
      pendingOperatorWinner: null,
      excludedNumbers: Array.from({ length: 33 }, (_, index) => index + 1).filter((value) => value !== 24)
    };

    mocks.privateDrawFindUnique.mockImplementation(async () => currentDraw);
    mocks.privateDrawUpdateMany.mockImplementation(async ({ where, data }: { where: { updatedAt?: Date }; data: { minNumber?: number; maxNumber?: number; updatedAt?: Date } }) => {
      if (where.updatedAt?.toISOString() !== currentDraw.updatedAt.toISOString()) {
        return { count: 0 };
      }

      currentDraw = {
        ...currentDraw,
        minNumber: data.minNumber ?? currentDraw.minNumber,
        maxNumber: data.maxNumber ?? currentDraw.maxNumber,
        updatedAt: data.updatedAt ?? new Date("2026-08-21T00:02:00.000Z")
      };
      return { count: 1 };
    });
    mocks.privateDrawSpinCreate.mockImplementation(async ({ data }: { data: { requestedMin: number; requestedMax: number; winningNumber: number } }) => ({
      id: `draw-spin-${data.winningNumber}`,
      winningNumber: data.winningNumber,
      createdAt: new Date("2026-08-21T01:02:03.000Z")
    }));

    const save = await livePatch(liveRangeRequest({ from: 1, to: 30, revision: baseDraw.updatedAt.toISOString() }), {
      params: Promise.resolve({ publicCode: "A7K29P" })
    });
    const admin = await adminGet(
      new NextRequest("http://localhost:3000/api/admin/draws/draw-1", {
        headers: { origin: "http://localhost:3000" }
      }),
      { params: Promise.resolve({ id: "draw-1" }) }
    );
    const spin = await spinPost(audienceRequest(), { params: Promise.resolve({ publicCode: "A7K29P" }) });
    const saveBody = await save.json();
    const adminBody = await admin.json();
    const spinBody = await spin.json();

    expect(save.status).toBe(200);
    expect(saveBody).toEqual(expect.objectContaining({ from: 1, to: 30 }));
    expect(admin.status).toBe(200);
    expect(adminBody.draw).toEqual(expect.objectContaining({ minNumber: 1, maxNumber: 30 }));
    expect(spin.status).toBe(200);
    expect(spinBody).toEqual(expect.objectContaining({ winner: 24, from: 1, to: 30 }));
  });

  it("deactivating a draw prevents audience spins", async () => {
    const { POST } = await import("@/app/api/draw/[publicCode]/spin/route");
    mocks.privateDrawFindUnique.mockResolvedValue({ ...baseDraw, isActive: false });

    const response = await POST(audienceRequest(), { params: Promise.resolve({ publicCode: "A7K29P" }) });

    expect(response.status).toBe(404);
    expect(mocks.privateDrawSpinCreate).not.toHaveBeenCalled();
  });

  it("archived audience draw cannot be used normally", async () => {
    const { POST } = await import("@/app/api/draw/[publicCode]/spin/route");
    mocks.privateDrawFindUnique.mockResolvedValue({ ...baseDraw, isActive: false, archivedAt: new Date("2026-08-22T00:00:00.000Z") });

    const response = await POST(audienceRequest(), { params: Promise.resolve({ publicCode: "A7K29P" }) });

    expect(response.status).toBe(404);
    expect(mocks.privateDrawSpinCreate).not.toHaveBeenCalled();
  });

  it("active draw cannot be permanently deleted directly", async () => {
    const { DELETE } = await import("@/app/api/admin/draws/[id]/route");
    const response = await DELETE(
      new NextRequest("http://localhost:3000/api/admin/draws/draw-1", {
        method: "DELETE",
        body: JSON.stringify({ confirmation: "PERMANENTLY DELETE" }),
        headers: { "content-type": "application/json", origin: "http://localhost:3000" }
      }),
      { params: Promise.resolve({ id: "draw-1" }) }
    );

    expect(response.status).toBe(400);
    expect(mocks.privateDrawDelete).not.toHaveBeenCalled();
  });

  it("inactive draw can be archived", async () => {
    const archivedAt = new Date("2026-08-22T00:00:00.000Z");
    mocks.privateDrawFindUnique.mockResolvedValue({ ...baseDraw, isActive: false, pendingOperatorWinner: 7 });
    mocks.privateDrawUpdate.mockResolvedValue({ ...baseDraw, isActive: false, pendingOperatorWinner: null, archivedAt });
    const { PATCH } = await import("@/app/api/admin/draws/[id]/route");
    const response = await PATCH(
      new NextRequest("http://localhost:3000/api/admin/draws/draw-1", {
        method: "PATCH",
        body: JSON.stringify({ action: "archive" }),
        headers: { "content-type": "application/json", origin: "http://localhost:3000" }
      }),
      { params: Promise.resolve({ id: "draw-1" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.message).toBe("Draw archived successfully.");
    expect(body.draw.archivedAt).toBeTruthy();
    expect(mocks.privateDrawUpdate).toHaveBeenCalledWith({
      where: { id: "draw-1" },
      data: expect.objectContaining({ isActive: false, pendingOperatorWinner: null, archivedAt: expect.any(Date) })
    });
  });

  it("archived draw can be restored as inactive", async () => {
    mocks.privateDrawFindUnique.mockResolvedValue({ ...baseDraw, isActive: false, archivedAt: new Date("2026-08-22T00:00:00.000Z") });
    mocks.privateDrawUpdate.mockResolvedValue({ ...baseDraw, isActive: false, archivedAt: null });
    const { PATCH } = await import("@/app/api/admin/draws/[id]/route");
    const response = await PATCH(
      new NextRequest("http://localhost:3000/api/admin/draws/draw-1", {
        method: "PATCH",
        body: JSON.stringify({ action: "restore" }),
        headers: { "content-type": "application/json", origin: "http://localhost:3000" }
      }),
      { params: Promise.resolve({ id: "draw-1" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.message).toBe("Draw restored successfully.");
    expect(body.draw.archivedAt).toBeNull();
    expect(body.draw.isActive).toBe(false);
  });

  it("archived draw can be permanently deleted without touching another draw", async () => {
    mocks.privateDrawFindUnique.mockResolvedValue({ ...baseDraw, archivedAt: new Date("2026-08-22T00:00:00.000Z") });
    const { DELETE } = await import("@/app/api/admin/draws/[id]/route");
    const response = await DELETE(
      new NextRequest("http://localhost:3000/api/admin/draws/draw-1", {
        method: "DELETE",
        body: JSON.stringify({ confirmation: "PERMANENTLY DELETE" }),
        headers: { "content-type": "application/json", origin: "http://localhost:3000" }
      }),
      { params: Promise.resolve({ id: "draw-1" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ deletedId: "draw-1", message: "Draw permanently deleted." });
    expect(mocks.privateDrawDelete).toHaveBeenCalledWith({ where: { id: "draw-1" } });
    expect(mocks.privateDrawDelete).not.toHaveBeenCalledWith({ where: { id: "draw-2" } });
  });

  it("operator private draw with no pending winner succeeds with secure random fallback", async () => {
    const { POST } = await import("@/app/api/draw/[publicCode]/spin/route");
    mocks.privateDrawFindUnique.mockResolvedValue({
      ...baseDraw,
      mode: "OPERATOR",
      pendingOperatorWinner: null,
      excludedNumbers: [2, 3, 4, 5, 6, 7, 8, 9, 10]
    });
    mocks.privateDrawSpinCreate.mockImplementation(async ({ data }: { data: { winningNumber: number; mode: string } }) => ({
      id: "draw-spin-random-fallback",
      winningNumber: data.winningNumber,
      createdAt: new Date("2026-08-21T01:02:03.000Z"),
      mode: data.mode
    }));

    const response = await POST(audienceRequest(), { params: Promise.resolve({ publicCode: "A7K29P" }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.winner).toBe(1);
    expect(body.mode).toBe("RANDOM");
    expect(body.nextLabel).toBe("RANDOM DRAW");
    expect(mocks.privateDrawUpdateMany).not.toHaveBeenCalled();
    expect(mocks.privateDrawSpinCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ winningNumber: 1, mode: "RANDOM" })
      })
    );
  });

  it.each([3, 28, 66, 100, 101, 250, 500, 1000])("private operator fallback accepts range 1-%i", async (maxNumber) => {
    const { POST } = await import("@/app/api/draw/[publicCode]/spin/route");
    mocks.privateDrawFindUnique.mockResolvedValue({
      ...baseDraw,
      minNumber: 1,
      maxNumber,
      mode: "OPERATOR",
      pendingOperatorWinner: null,
      excludedNumbers: Array.from({ length: maxNumber - 1 }, (_, index) => index + 2)
    });
    mocks.privateDrawSpinCreate.mockImplementation(async ({ data }: { data: { requestedMax: number; winningNumber: number; mode: string } }) => ({
      id: `draw-spin-range-${data.requestedMax}`,
      winningNumber: data.winningNumber,
      createdAt: new Date("2026-08-21T01:02:03.000Z"),
      mode: data.mode
    }));

    const response = await POST(audienceRequest(), { params: Promise.resolve({ publicCode: "A7K29P" }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.from).toBe(1);
    expect(body.to).toBe(maxNumber);
    expect(body.winner).toBe(1);
    expect(mocks.privateDrawSpinCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ requestedMin: 1, requestedMax: maxNumber, winningNumber: 1, mode: "RANDOM" })
      })
    );
  });

  it("private range changes 28 to 27 to 26 and later increases on the same public code", async () => {
    const { POST } = await import("@/app/api/draw/[publicCode]/spin/route");
    const liveRanges = [28, 27, 26, 66];
    mocks.privateDrawFindUnique.mockImplementation(async () => {
      const maxNumber = liveRanges.shift() ?? 66;
      return {
        ...baseDraw,
        minNumber: 1,
        maxNumber,
        mode: "OPERATOR",
        pendingOperatorWinner: null,
        excludedNumbers: Array.from({ length: maxNumber - 1 }, (_, index) => index + 2)
      };
    });
    mocks.privateDrawSpinCreate.mockImplementation(async ({ data }: { data: { requestedMax: number; winningNumber: number; mode: string } }) => ({
      id: `draw-spin-live-${data.requestedMax}`,
      winningNumber: data.winningNumber,
      createdAt: new Date("2026-08-21T01:02:03.000Z"),
      mode: data.mode
    }));

    const responses = await Promise.all([
      POST(audienceRequest(), { params: Promise.resolve({ publicCode: "A7K29P" }) }),
      POST(audienceRequest(), { params: Promise.resolve({ publicCode: "A7K29P" }) }),
      POST(audienceRequest(), { params: Promise.resolve({ publicCode: "A7K29P" }) }),
      POST(audienceRequest(), { params: Promise.resolve({ publicCode: "A7K29P" }) })
    ]);
    const bodies = await Promise.all(responses.map((response) => response.json()));

    expect(responses.map((response) => response.status)).toEqual([200, 200, 200, 200]);
    expect(bodies.map((body) => body.to)).toEqual([28, 27, 26, 66]);
    expect(bodies.every((body) => body.winner === 1)).toBe(true);
    expect(mocks.privateDrawFindUnique).toHaveBeenCalledTimes(4);
    expect(mocks.privateDrawSpinCreate).toHaveBeenCalledTimes(4);
  });

  it("uses the updated same-row range after 1-6 expands to 1-30 and can return 24 deterministically", async () => {
    const { GET, POST } = await import("@/app/api/draw/[publicCode]/spin/route");
    const oldRangeDraw = {
      ...baseDraw,
      minNumber: 1,
      maxNumber: 6,
      mode: "RANDOM",
      pendingOperatorWinner: null,
      excludedNumbers: [1, 3, 4, 5, 6]
    };
    const updatedRangeDraw = {
      ...baseDraw,
      minNumber: 1,
      maxNumber: 30,
      mode: "RANDOM",
      pendingOperatorWinner: null,
      excludedNumbers: Array.from({ length: 30 }, (_, index) => index + 1).filter((value) => value !== 24)
    };

    mocks.privateDrawFindUnique.mockResolvedValueOnce(oldRangeDraw).mockResolvedValue(updatedRangeDraw);
    mocks.privateDrawSpinCreate.mockImplementation(async ({ data }: { data: { requestedMin: number; requestedMax: number; winningNumber: number } }) => ({
      id: `draw-spin-${data.winningNumber}`,
      winningNumber: data.winningNumber,
      createdAt: new Date("2026-08-21T01:02:03.000Z")
    }));

    const firstSpin = await POST(audienceRequest(), { params: Promise.resolve({ publicCode: "A7K29P" }) });
    const firstBody = await firstSpin.json();
    const state = await GET(new NextRequest("http://localhost:3000/api/draw/A7K29P/spin"), {
      params: Promise.resolve({ publicCode: "A7K29P" })
    });
    const stateBody = await state.json();
    const secondSpin = await POST(audienceRequest({ from: 1, to: 6 }), { params: Promise.resolve({ publicCode: "A7K29P" }) });
    const secondBody = await secondSpin.json();

    expect(firstSpin.status).toBe(200);
    expect(firstBody).toEqual(expect.objectContaining({ winner: 2, from: 1, to: 6 }));
    expect(state.status).toBe(200);
    expect(stateBody).toEqual(expect.objectContaining({ from: 1, to: 30 }));
    expect(secondSpin.status).toBe(200);
    expect(secondBody).toEqual(expect.objectContaining({ winner: 24, from: 1, to: 30 }));
    expect(mocks.privateDrawSpinCreate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          privateDrawId: "draw-1",
          requestedMin: 1,
          requestedMax: 30,
          winningNumber: 24,
          eligibleCount: 1
        })
      })
    );
  });

  it("friendly slug and public code resolve to the same private draw row", async () => {
    const { getPrivateDrawAudience } = await import("@/lib/private-draws");
    const draw = { ...baseDraw, publicCode: "ABC12345", liveSlug: "friday", minNumber: 1, maxNumber: 30 };
    mocks.privateDrawFindUnique.mockResolvedValue(draw);

    const bySlug = await getPrivateDrawAudience("friday");
    const byPublicCode = await getPrivateDrawAudience("ABC12345");

    expect(bySlug?.id).toBe("draw-1");
    expect(byPublicCode?.id).toBe("draw-1");
    expect(bySlug?.id).toBe(byPublicCode?.id);
    expect(mocks.privateDrawFindFirst).toHaveBeenNthCalledWith(1, {
      where: { OR: [{ publicCode: "FRIDAY" }, { liveSlug: "friday" }] }
    });
    expect(mocks.privateDrawFindFirst).toHaveBeenNthCalledWith(2, {
      where: { OR: [{ publicCode: "ABC12345" }, { liveSlug: "abc12345" }] }
    });
  });

  it("rejects any selected private winner outside the current database range before recording history", async () => {
    const { POST } = await import("@/app/api/draw/[publicCode]/spin/route");
    mocks.privateDrawFindUnique.mockResolvedValue({ ...baseDraw, minNumber: 1, maxNumber: 6, pendingOperatorWinner: 24, excludedNumbers: [] });

    const response = await POST(audienceRequest(), { params: Promise.resolve({ publicCode: "A7K29P" }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.winner).toBeGreaterThanOrEqual(1);
    expect(body.winner).toBeLessThanOrEqual(6);
    expect(body.from).toBe(1);
    expect(body.to).toBe(6);
    expect(mocks.privateDrawSpinCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ requestedMin: 1, requestedMax: 6 })
      })
    );
  });

  it("private spin rejects an invalid stored FROM greater than TO range", async () => {
    const { POST } = await import("@/app/api/draw/[publicCode]/spin/route");
    mocks.privateDrawFindUnique.mockResolvedValue({ ...baseDraw, minNumber: 10, maxNumber: 1, mode: "OPERATOR", pendingOperatorWinner: null });

    const response = await POST(audienceRequest(), { params: Promise.resolve({ publicCode: "A7K29P" }) });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("FROM must be smaller than TO.");
    expect(mocks.privateDrawSpinCreate).not.toHaveBeenCalled();
  });

  it("private spin rejects forged ranges above 1000 clearly", async () => {
    const { POST } = await import("@/app/api/draw/[publicCode]/spin/route");
    mocks.privateDrawFindUnique.mockResolvedValue({ ...baseDraw, minNumber: 1, maxNumber: 1001, mode: "OPERATOR", pendingOperatorWinner: null });

    const response = await POST(audienceRequest(), { params: Promise.resolve({ publicCode: "A7K29P" }) });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Maximum supported number is 1,000.");
    expect(mocks.privateDrawSpinCreate).not.toHaveBeenCalled();
  });

  it("audience spin returns selected operator winner without exposing pending state", async () => {
    const { POST } = await import("@/app/api/draw/[publicCode]/spin/route");
    const response = await POST(audienceRequest(), { params: Promise.resolve({ publicCode: "A7K29P" }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      spinId: "draw-spin-1",
      winner: 7,
      timestamp: "2026-08-21T01:02:03.000Z",
      from: 1,
      to: 10,
      mode: "OPERATOR",
      nextLabel: "RANDOM DRAW"
    });
    expect(JSON.stringify(body)).not.toContain("pendingOperatorWinner");
    expect(JSON.stringify(body)).not.toContain("excludedNumbers");
    expect(mocks.privateDrawUpdateMany).toHaveBeenCalledWith({
      where: { id: "draw-1", pendingOperatorWinner: 7 },
      data: { pendingOperatorWinner: null }
    });
    expect(mocks.rateLimit).toHaveBeenCalledWith("draw-spin:A7K29P:local-development", expect.any(Number), 60_000, {
      allowOnInfrastructureFailure: true,
      endpoint: "private number spin"
    });
  });

  it("audience draw data exposes display style but not private configuration", async () => {
    const { getPrivateDrawAudience } = await import("@/lib/private-draws");
    mocks.privateDrawFindUnique.mockResolvedValue({ ...baseDraw, displayStyle: "NUMBER_ROLLER" });

    const draw = await getPrivateDrawAudience("A7K29P");

    expect(draw).toEqual({
      id: "draw-1",
      publicCode: "A7K29P",
      liveSlug: null,
      name: "Event Draw",
      minNumber: 1,
      maxNumber: 10,
      mode: "OPERATOR",
      displayStyle: "NUMBER_ROLLER",
      label: "OPERATOR DRAW",
      revision: "2026-08-21T00:00:00.000Z"
    });
    expect(JSON.stringify(draw)).not.toContain("pendingOperatorWinner");
    expect(JSON.stringify(draw)).not.toContain("excludedNumbers");
  });

  it("audience draw state endpoint exposes only safe authoritative range metadata", async () => {
    const { GET } = await import("@/app/api/draw/[publicCode]/spin/route");
    mocks.privateDrawFindUnique.mockResolvedValue({ ...baseDraw, minNumber: 1, maxNumber: 25, displayStyle: "NUMBER_ROLLER" });

    const response = await GET(new NextRequest("http://localhost:3000/api/draw/A7K29P/spin"), {
      params: Promise.resolve({ publicCode: "A7K29P" })
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      from: 1,
      to: 25,
      label: "OPERATOR DRAW",
      displayStyle: "NUMBER_ROLLER",
      revision: "2026-08-21T00:00:00.000Z"
    });
    expect(JSON.stringify(body)).not.toContain("pendingOperatorWinner");
    expect(JSON.stringify(body)).not.toContain("excludedNumbers");
    expect(JSON.stringify(body)).not.toContain("draw-1");
  });

  it("audience label is random when operator mode has no pending next winner", async () => {
    const { getPrivateDrawAudience } = await import("@/lib/private-draws");
    mocks.privateDrawFindUnique.mockResolvedValue({ ...baseDraw, pendingOperatorWinner: null });

    const draw = await getPrivateDrawAudience("A7K29P");

    expect(draw?.mode).toBe("OPERATOR");
    expect(draw?.label).toBe("RANDOM DRAW");
    expect(JSON.stringify(draw)).not.toContain("pendingOperatorWinner");
  });

  it("clears selected winner after one use and falls back to random on the next spin", async () => {
    const { POST } = await import("@/app/api/draw/[publicCode]/spin/route");
    mocks.privateDrawFindUnique
      .mockResolvedValueOnce(baseDraw)
      .mockResolvedValueOnce({ ...baseDraw, pendingOperatorWinner: null, excludedNumbers: [2, 3, 4, 5, 6, 7, 8, 9, 10] });
    mocks.privateDrawSpinCreate.mockImplementation(async ({ data }: { data: { winningNumber: number; mode: string } }) => ({
      id: `draw-spin-${data.mode.toLowerCase()}`,
      winningNumber: data.winningNumber,
      createdAt: new Date("2026-08-21T01:02:03.000Z"),
      mode: data.mode
    }));

    const first = await POST(audienceRequest(), { params: Promise.resolve({ publicCode: "A7K29P" }) });
    const second = await POST(audienceRequest(), { params: Promise.resolve({ publicCode: "A7K29P" }) });
    const firstBody = await first.json();
    const secondBody = await second.json();

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(firstBody.winner).toBe(7);
    expect(secondBody.winner).toBe(1);
    expect(mocks.privateDrawSpinCreate).toHaveBeenCalledTimes(2);
    expect(mocks.privateDrawSpinCreate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ data: expect.objectContaining({ winningNumber: 7, mode: "OPERATOR" }) })
    );
    expect(mocks.privateDrawSpinCreate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ data: expect.objectContaining({ winningNumber: 1, mode: "RANDOM" }) })
    );
  });

  it("can use another pending winner after random fallback rounds", async () => {
    const { POST } = await import("@/app/api/draw/[publicCode]/spin/route");
    mocks.privateDrawFindUnique
      .mockResolvedValueOnce(baseDraw)
      .mockResolvedValueOnce({ ...baseDraw, pendingOperatorWinner: null, excludedNumbers: [2, 3, 4, 5, 6, 7, 8, 9, 10] })
      .mockResolvedValueOnce({ ...baseDraw, pendingOperatorWinner: 5, excludedNumbers: [2, 4, 6, 8, 10] });
    mocks.privateDrawSpinCreate.mockImplementation(async ({ data }: { data: { winningNumber: number; mode: string } }) => ({
      id: `draw-spin-${data.winningNumber}`,
      winningNumber: data.winningNumber,
      createdAt: new Date("2026-08-21T01:02:03.000Z"),
      mode: data.mode
    }));

    const first = await POST(audienceRequest(), { params: Promise.resolve({ publicCode: "A7K29P" }) });
    const second = await POST(audienceRequest(), { params: Promise.resolve({ publicCode: "A7K29P" }) });
    const third = await POST(audienceRequest(), { params: Promise.resolve({ publicCode: "A7K29P" }) });
    const firstBody = await first.json();
    const secondBody = await second.json();
    const thirdBody = await third.json();

    expect(firstBody.winner).toBe(7);
    expect(secondBody.winner).toBe(1);
    expect(thirdBody.winner).toBe(5);
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(third.status).toBe(200);
    expect(mocks.privateDrawUpdateMany).toHaveBeenNthCalledWith(1, {
      where: { id: "draw-1", pendingOperatorWinner: 7 },
      data: { pendingOperatorWinner: null }
    });
    expect(mocks.privateDrawUpdateMany).toHaveBeenNthCalledWith(2, {
      where: { id: "draw-1", pendingOperatorWinner: 5 },
      data: { pendingOperatorWinner: null }
    });
  });

  it("invalid pending winner after range reduction is cleared and falls back to random", async () => {
    const { POST } = await import("@/app/api/draw/[publicCode]/spin/route");
    mocks.privateDrawFindUnique.mockResolvedValue({
      ...baseDraw,
      minNumber: 1,
      maxNumber: 5,
      excludedNumbers: [2, 3, 4, 5],
      pendingOperatorWinner: 9
    });
    mocks.privateDrawSpinCreate.mockImplementation(async ({ data }: { data: { winningNumber: number; mode: string } }) => ({
      id: "draw-spin-invalid-fallback",
      winningNumber: data.winningNumber,
      createdAt: new Date("2026-08-21T01:02:03.000Z"),
      mode: data.mode
    }));

    const response = await POST(audienceRequest(), { params: Promise.resolve({ publicCode: "A7K29P" }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.winner).toBe(1);
    expect(mocks.privateDrawUpdateMany).toHaveBeenCalledWith({
      where: { id: "draw-1", pendingOperatorWinner: 9 },
      data: { pendingOperatorWinner: null }
    });
    expect(mocks.privateDrawSpinCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ winningNumber: 1, mode: "RANDOM" }) })
    );
  });

  it("excluded pending winner is cleared and cannot be used", async () => {
    const { POST } = await import("@/app/api/draw/[publicCode]/spin/route");
    mocks.privateDrawFindUnique.mockResolvedValue({
      ...baseDraw,
      excludedNumbers: [2, 3, 4, 5, 6, 7, 8, 9, 10],
      pendingOperatorWinner: 7
    });
    mocks.privateDrawSpinCreate.mockImplementation(async ({ data }: { data: { winningNumber: number; mode: string } }) => ({
      id: "draw-spin-excluded-fallback",
      winningNumber: data.winningNumber,
      createdAt: new Date("2026-08-21T01:02:03.000Z"),
      mode: data.mode
    }));

    const response = await POST(audienceRequest(), { params: Promise.resolve({ publicCode: "A7K29P" }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.winner).toBe(1);
    expect(body.winner).not.toBe(7);
    expect(mocks.privateDrawUpdateMany).toHaveBeenCalledWith({
      where: { id: "draw-1", pendingOperatorWinner: 7 },
      data: { pendingOperatorWinner: null }
    });
  });

  it("concurrent requests cannot consume the same pending winner twice", async () => {
    const { POST } = await import("@/app/api/draw/[publicCode]/spin/route");
    mocks.privateDrawUpdateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });

    const first = await POST(audienceRequest(), { params: Promise.resolve({ publicCode: "A7K29P" }) });
    const second = await POST(audienceRequest(), { params: Promise.resolve({ publicCode: "A7K29P" }) });

    expect(first.status).toBe(200);
    expect(second.status).toBe(400);
    expect(mocks.privateDrawSpinCreate).toHaveBeenCalledTimes(1);
  });

  it("audience cannot force a winner or private range through request body", async () => {
    const { POST } = await import("@/app/api/draw/[publicCode]/spin/route");
    mocks.privateDrawFindUnique.mockResolvedValue({
      ...baseDraw,
      minNumber: 1,
      maxNumber: 5,
      excludedNumbers: [2, 3, 4, 5, 6, 7, 8, 9, 10],
      mode: "RANDOM",
      pendingOperatorWinner: null
    });
    mocks.privateDrawSpinCreate.mockResolvedValue({
      id: "draw-spin-1",
      winningNumber: 1,
      createdAt: new Date("2026-08-21T01:02:03.000Z")
    });

    const response = await POST(audienceRequest({ from: 1, to: 25, winner: 8, nextWinner: 8, mode: "OPERATOR" }), {
      params: Promise.resolve({ publicCode: "A7K29P" })
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.winner).toBe(1);
    expect(body.from).toBe(1);
    expect(body.to).toBe(5);
    expect(body.winner).not.toBe(8);
    expect(mocks.privateDrawSpinCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ requestedMin: 1, requestedMax: 5, winningNumber: 1 })
      })
    );
  });

  it("random mode does not secretly consume or use a pending operator number", async () => {
    const { POST } = await import("@/app/api/draw/[publicCode]/spin/route");
    mocks.privateDrawFindUnique.mockResolvedValue({
      ...baseDraw,
      excludedNumbers: [2, 3, 4, 5, 6, 7, 8, 9, 10],
      mode: "RANDOM",
      pendingOperatorWinner: 9
    });
    mocks.privateDrawSpinCreate.mockImplementation(async ({ data }: { data: { winningNumber: number; mode: string } }) => ({
      id: "draw-spin-random",
      winningNumber: data.winningNumber,
      createdAt: new Date("2026-08-21T01:02:03.000Z"),
      mode: data.mode
    }));

    const response = await POST(audienceRequest(), { params: Promise.resolve({ publicCode: "A7K29P" }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.winner).toBe(1);
    expect(body.winner).not.toBe(9);
    expect(mocks.privateDrawUpdateMany).not.toHaveBeenCalled();
    expect(mocks.privateDrawSpinCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ winningNumber: 1, mode: "RANDOM" })
      })
    );
  });

  it("keeps private draw results isolated by public code", async () => {
    const drawA = { ...baseDraw, id: "draw-a", publicCode: "AAAA2222", pendingOperatorWinner: 3, excludedNumbers: [] };
    const drawB = { ...baseDraw, id: "draw-b", publicCode: "BBBB3333", pendingOperatorWinner: 9, excludedNumbers: [] };
    mocks.privateDrawFindFirst.mockImplementation(async ({ where }: { where: { OR?: Array<{ publicCode?: string; liveSlug?: string }> } }) => {
      const publicCode = where.OR?.find((item) => item.publicCode)?.publicCode;
      return publicCode === "BBBB3333" ? drawB : drawA;
    });
    mocks.privateDrawSpinCreate.mockImplementation(async ({ data }: { data: { privateDrawId: string; winningNumber: number } }) => ({
      id: `spin-${data.privateDrawId}`,
      winningNumber: data.winningNumber,
      createdAt: new Date("2026-08-21T01:02:03.000Z")
    }));

    const { POST } = await import("@/app/api/draw/[publicCode]/spin/route");
    const first = await POST(audienceRequest(), { params: Promise.resolve({ publicCode: "AAAA2222" }) });
    const second = await POST(audienceRequest(), { params: Promise.resolve({ publicCode: "BBBB3333" }) });
    const firstBody = await first.json();
    const secondBody = await second.json();

    expect(firstBody.winner).toBe(3);
    expect(secondBody.winner).toBe(9);
    expect(mocks.privateDrawUpdateMany).toHaveBeenNthCalledWith(1, {
      where: { id: "draw-a", pendingOperatorWinner: 3 },
      data: { pendingOperatorWinner: null }
    });
    expect(mocks.privateDrawUpdateMany).toHaveBeenNthCalledWith(2, {
      where: { id: "draw-b", pendingOperatorWinner: 9 },
      data: { pendingOperatorWinner: null }
    });
  });

  it("generates uppercase unique public codes without Math.random", async () => {
    const randomSpy = vi.spyOn(Math, "random");
    const { generatePrivateDrawPublicCode } = await import("@/lib/private-draws");
    const codes = Array.from({ length: 200 }, () => generatePrivateDrawPublicCode());

    expect(new Set(codes).size).toBe(codes.length);
    expect(codes.every((code) => /^[A-HJ-NP-Z2-9]{8}$/.test(code))).toBe(true);
    expect(randomSpy).not.toHaveBeenCalled();
    randomSpy.mockRestore();
  });

  it("retries public code generation after a unique collision", async () => {
    const collision = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
      code: "P2002",
      clientVersion: "test",
      meta: { target: ["publicCode"] }
    });
    mocks.privateDrawCreate
      .mockRejectedValueOnce(collision)
      .mockImplementationOnce(async ({ data }: { data: Record<string, unknown> }) => ({ ...baseDraw, ...data }));

    const { createPrivateDraw } = await import("@/lib/private-draws");
    const created = await createPrivateDraw({
      name: "Collision Retry",
      minNumber: 1,
      maxNumber: 30,
      excludedNumbers: [],
      mode: "RANDOM",
      isActive: true
    });

    expect(created.publicCode).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
    expect(mocks.privateDrawCreate).toHaveBeenCalledTimes(2);
  });
});
