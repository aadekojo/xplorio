import { MockFlightProvider } from "@xplorio/providers";
import { beforeEach, describe, expect, it } from "vitest";
import { FlightService } from "./flightService.js";
import { HttpError } from "./http.js";
import { MemoryFlightStore } from "./store.js";

const NOW = new Date("2026-11-01T12:00:00Z");
const clock = () => NOW;

let service: FlightService;
beforeEach(() => {
  service = new FlightService(new MemoryFlightStore(), new MockFlightProvider(clock), clock);
});

async function expectHttpError(p: Promise<unknown>, status: number) {
  await expect(p).rejects.toBeInstanceOf(HttpError);
  await expect(p).rejects.toMatchObject({ status });
}

describe("FlightService", () => {
  it("adds a flight and returns it with its status", async () => {
    const view = await service.add("u1", { number: "ac 262", localDate: "2026-11-02" });
    expect(view.tracked.number).toBe("AC262");
    expect(view.tracked.userId).toBe("u1");
    expect(view.flight?.flightKey).toBe("AC262_2026-11-02");
  });

  it("keeps each user's flights separate", async () => {
    const a = await service.add("u1", { number: "AC262", localDate: "2026-11-02" });
    expect(await service.list("u2")).toEqual([]);
    await expectHttpError(service.get("u2", a.tracked.id), 404);
    await expectHttpError(service.remove("u2", a.tracked.id), 404);
    expect(await service.list("u1")).toHaveLength(1);
  });

  it("lists flights in departure order", async () => {
    await service.add("u1", { number: "WS123", localDate: "2026-11-05" });
    await service.add("u1", { number: "AC262", localDate: "2026-11-02" });
    const dates = (await service.list("u1")).map((v) => v.tracked.localDate);
    expect(dates).toEqual(["2026-11-02", "2026-11-05"]);
  });

  it("rejects duplicates, bad input and far-off dates", async () => {
    await service.add("u1", { number: "AC262", localDate: "2026-11-02" });
    await expectHttpError(service.add("u1", { number: "AC262", localDate: "2026-11-02" }), 409);
    await expectHttpError(service.add("u1", { number: "nope", localDate: "2026-11-02" }), 400);
    await expectHttpError(service.add("u1", { number: "AC262", localDate: "2028-01-01" }), 400);
    await expectHttpError(service.add("u1", { userId: "someone-else" }), 400);
  });

  it("removes a flight", async () => {
    const v = await service.add("u1", { number: "AC262", localDate: "2026-11-02" });
    await service.remove("u1", v.tracked.id);
    expect(await service.list("u1")).toEqual([]);
  });
});
