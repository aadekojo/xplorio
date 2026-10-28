import { describe, expect, it } from "vitest";
import { health } from "./health.js";

describe("health", () => {
  it("reports ok without caching", () => {
    const res = health(new Date("2026-11-02T12:00:00Z"));
    expect(res.status).toBe(200);
    expect(res.headers).toEqual({ "Cache-Control": "no-store" });
    expect(res.jsonBody).toEqual({
      status: "ok",
      service: "xplorio-api",
      time: "2026-11-02T12:00:00.000Z",
    });
  });
});
