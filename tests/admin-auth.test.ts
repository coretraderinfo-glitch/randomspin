import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/admin/wheel/route";

describe("admin API protection", () => {
  it("rejects unauthorized admin wheel access", async () => {
    const response = await GET(new NextRequest("http://localhost:3000/api/admin/wheel"));
    expect(response.status).toBe(401);
  });
});
