import type { Flight, TrackedFlight } from "@xplorio/core";
import { describe, expect, it } from "vitest";
import { cacheTtlSeconds, CosmosFlightStore } from "./cosmosStore.js";
import { MemoryFlightStore, type FlightStore } from "./store.js";
import { fakeContainer } from "./testing/fakeCosmos.js";

const NOW = new Date("2026-11-01T12:00:00Z");

const tracked = (userId: string, n: number): TrackedFlight => ({
  id: `00000000-0000-4000-8000-00000000000${n}`,
  userId,
  flightKey: `AC26${n}_2026-11-02`,
  number: `AC26${n}`,
  localDate: "2026-11-02",
  alerts: { delay: true, gateChange: true, departed: true, landed: true, cancelled: true },
  createdAt: NOW.toISOString(),
});

const flight = (key: string, arrival = "2026-11-02T16:40:00Z"): Flight => ({
  flightKey: key,
  number: key.split("_")[0]!,
  localDate: "2026-11-02",
  status: "scheduled",
  departure: { airport: { iata: "YWG" }, times: { scheduled: "2026-11-02T14:00:00Z" } },
  arrival: { airport: { iata: "YYZ" }, times: { scheduled: arrival } },
  fetchedAt: NOW.toISOString(),
});

// The same behaviour is required of every FlightStore implementation.
const stores: Array<[string, () => FlightStore]> = [
  ["MemoryFlightStore", () => new MemoryFlightStore()],
  [
    "CosmosFlightStore",
    () => new CosmosFlightStore(fakeContainer("/userId"), fakeContainer("/flightKey"), () => NOW),
  ],
];

describe.each(stores)("%s", (_name, make) => {
  it("saves, lists, finds and removes a user's flights", async () => {
    const store = make();
    await store.addTracked(tracked("u1", 1));
    await store.addTracked(tracked("u1", 2));

    expect(await store.listTracked("u1")).toHaveLength(2);
    expect((await store.getTracked("u1", tracked("u1", 1).id))?.number).toBe("AC261");
    expect((await store.findTrackedByKey("u1", "AC262_2026-11-02"))?.number).toBe("AC262");

    expect(await store.removeTracked("u1", tracked("u1", 1).id)).toBe(true);
    expect(await store.removeTracked("u1", tracked("u1", 1).id)).toBe(false);
    expect(await store.listTracked("u1")).toHaveLength(1);
  });

  it("never returns another user's flights", async () => {
    const store = make();
    await store.addTracked(tracked("u1", 1));
    expect(await store.listTracked("u2")).toEqual([]);
    expect(await store.getTracked("u2", tracked("u1", 1).id)).toBeUndefined();
    expect(await store.findTrackedByKey("u2", tracked("u1", 1).flightKey)).toBeUndefined();
    expect(await store.removeTracked("u2", tracked("u1", 1).id)).toBe(false);
    expect(await store.listTracked("u1")).toHaveLength(1);
  });

  it("returns clean objects without database system fields", async () => {
    const store = make();
    await store.addTracked(tracked("u1", 1));
    const got = await store.getTracked("u1", tracked("u1", 1).id);
    expect(got).toEqual(tracked("u1", 1));
  });

  it("caches and replaces flight status by flight key", async () => {
    const store = make();
    expect(await store.getCached("AC261_2026-11-02")).toBeUndefined();
    await store.putCached(flight("AC261_2026-11-02"));
    await store.putCached({ ...flight("AC261_2026-11-02"), status: "boarding" });
    expect((await store.getCached("AC261_2026-11-02"))?.status).toBe("boarding");
  });
});

describe("cacheTtlSeconds", () => {
  it("expires 30 days after arrival", () => {
    const ttl = cacheTtlSeconds(flight("X_1", "2026-11-02T12:00:00Z"), NOW);
    expect(ttl).toBe((1 + 30) * 24 * 60 * 60);
  });

  it("never drops below one day, even for old flights", () => {
    expect(cacheTtlSeconds(flight("X_1", "2026-01-01T00:00:00Z"), NOW)).toBe(24 * 60 * 60);
  });
});
