import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  getAdminFromRequest: vi.fn(),
  rateLimit: vi.fn(),
  privateDrawFindMany: vi.fn(),
  privateDrawFindUnique: vi.fn(),
  privateDrawCreate: vi.fn(),
  privateDrawUpdate: vi.fn(),
  privateDrawUpdateMany: vi.fn(),
  privateDrawSpinCreate: vi.fn(),
  transaction: vi.fn()
}));

vi.mock("@/lib/auth", () => ({ getAdminFromRequest: mocks.getAdminFromRequest }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: mocks.rateLimit }));
vi.mock("@/lib/db", () => ({
  prisma: {
    privateDraw: {
      findMany: mocks.privateDrawFindMany,
      findUnique: mocks.privateDrawFindUnique,
      create: mocks.privateDrawCreate,
      update: mocks.privateDrawUpdate,
      updateMany: mocks.privateDrawUpdateMany
    },
    privateDrawSpinResult: { create: mocks.privateDrawSpinCreate },
    $transaction: mocks.transaction
  }
}));

const baseDraw = {
  id: "draw-1",
  publicCode: "A7K29P",
  name: "Event Draw",
  minNumber: 1,
  maxNumber: 10,
  excludedNumbers: [2, 4, 6, 8, 10],
  mode: "OPERATOR",
  displayStyle: "WHEEL",
  pendingOperatorWinner: 7,
  isActive: true,
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
    mocks.privateDrawCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      ...baseDraw,
      id: "draw-created",
      ...data,
      createdAt: new Date("2026-08-21T00:00:00.000Z"),
      updatedAt: new Date("2026-08-21T00:00:00.000Z")
    }));
    mocks.privateDrawUpdate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ ...baseDraw, ...data }));
    mocks.privateDrawUpdateMany.mockResolvedValue({ count: 1 });
    mocks.privateDrawSpinCreate.mockResolvedValue({
      id: "draw-spin-1",
      winningNumber: 7,
      createdAt: new Date("2026-08-21T01:02:03.000Z")
    });
    mocks.transaction.mockImplementation(async (callback) =>
      callback({
        privateDraw: {
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
      headers: { "content-type": "application/json" }
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

  it("admin can set a valid next confirmed number", async () => {
    mocks.privateDrawFindUnique.mockResolvedValue({ ...baseDraw, minNumber: 1, maxNumber: 30, excludedNumbers: [3, 9, 13, 18] });
    const { PUT } = await import("@/app/api/admin/draws/[id]/route");
    const response = await PUT(adminRequest(adminPayload({ minNumber: 1, maxNumber: 30, excludedNumbers: [3, 9, 13, 18], nextWinner: 20, action: "set" })), {
      params: Promise.resolve({ id: "draw-1" })
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.draw.pendingOperatorWinner).toBe(20);
    expect(mocks.privateDrawUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ mode: "OPERATOR", pendingOperatorWinner: 20 })
      })
    );
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

  it("deactivating a draw prevents audience spins", async () => {
    const { POST } = await import("@/app/api/draw/[publicCode]/spin/route");
    mocks.privateDrawFindUnique.mockResolvedValue({ ...baseDraw, isActive: false });

    const response = await POST(audienceRequest(), { params: Promise.resolve({ publicCode: "A7K29P" }) });

    expect(response.status).toBe(404);
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
      to: 10
    });
    expect(JSON.stringify(body)).not.toContain("pendingOperatorWinner");
    expect(JSON.stringify(body)).not.toContain("excludedNumbers");
    expect(JSON.stringify(body)).not.toContain("OPERATOR");
    expect(mocks.privateDrawUpdateMany).toHaveBeenCalledWith({
      where: { id: "draw-1", pendingOperatorWinner: 7 },
      data: { pendingOperatorWinner: null }
    });
  });

  it("audience draw data exposes display style but not private configuration", async () => {
    const { getPrivateDrawAudience } = await import("@/lib/private-draws");
    mocks.privateDrawFindUnique.mockResolvedValue({ ...baseDraw, displayStyle: "NUMBER_ROLLER" });

    const draw = await getPrivateDrawAudience("A7K29P");

    expect(draw).toEqual({
      id: "draw-1",
      publicCode: "A7K29P",
      name: "Event Draw",
      minNumber: 1,
      maxNumber: 10,
      mode: "OPERATOR",
      displayStyle: "NUMBER_ROLLER",
      label: "OPERATOR DRAW"
    });
    expect(JSON.stringify(draw)).not.toContain("pendingOperatorWinner");
    expect(JSON.stringify(draw)).not.toContain("excludedNumbers");
  });

  it("clears selected winner after one use and does not reuse it", async () => {
    const { POST } = await import("@/app/api/draw/[publicCode]/spin/route");
    mocks.privateDrawFindUnique
      .mockResolvedValueOnce(baseDraw)
      .mockResolvedValueOnce({ ...baseDraw, pendingOperatorWinner: null });

    const first = await POST(audienceRequest(), { params: Promise.resolve({ publicCode: "A7K29P" }) });
    const second = await POST(audienceRequest(), { params: Promise.resolve({ publicCode: "A7K29P" }) });

    expect(first.status).toBe(200);
    expect(second.status).toBe(400);
    expect(mocks.privateDrawSpinCreate).toHaveBeenCalledTimes(1);
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

  it("audience cannot force a winner through request body", async () => {
    const { POST } = await import("@/app/api/draw/[publicCode]/spin/route");
    mocks.privateDrawFindUnique.mockResolvedValue({
      ...baseDraw,
      excludedNumbers: [2, 3, 4, 5, 6, 7, 8, 9, 10],
      mode: "RANDOM",
      pendingOperatorWinner: null
    });
    mocks.privateDrawSpinCreate.mockResolvedValue({
      id: "draw-spin-1",
      winningNumber: 1,
      createdAt: new Date("2026-08-21T01:02:03.000Z")
    });

    const response = await POST(audienceRequest({ winner: 8, nextWinner: 8, mode: "OPERATOR" }), {
      params: Promise.resolve({ publicCode: "A7K29P" })
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.winner).toBe(1);
    expect(body.winner).not.toBe(8);
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
    mocks.privateDrawFindUnique.mockImplementation(async ({ where }: { where: { publicCode?: string } }) =>
      where.publicCode === "BBBB3333" ? drawB : drawA
    );
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
