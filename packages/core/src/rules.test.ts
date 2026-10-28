import { describe, expect, it } from "vitest";
import { detectChanges, flightKey, nextPollAt } from "./rules.js";
import { AddFlightRequestSchema, type Flight } from "./schemas.js";

const base: Flight = {
  flightKey: "AC262_2026-11-02",
  number: "AC262",
  localDate: "2026-11-02",
  status: "scheduled",
  departure: {
    airport: { iata: "YWG" },
    gate: "8",
    times: { scheduled: "2026-11-02T14:00:00Z" },
  },
  arrival: {
    airport: { iata: "YYZ" },
    times: { scheduled: "2026-11-02T16:40:00Z" },
  },
  fetchedAt: "2026-11-02T08:00:00Z",
};

const at = (iso: string) => new Date(iso);

describe("flightKey", () => {
  it("joins number and date, adding a leg suffix only when needed", () => {
    expect(flightKey("ac262", "2026-11-02")).toBe("AC262_2026-11-02");
    expect(flightKey("AC262", "2026-11-02", 1)).toBe("AC262_2026-11-02_1");
  });
});

describe("AddFlightRequestSchema", () => {
  it("normalizes spacing and case in flight numbers", () => {
    const parsed = AddFlightRequestSchema.parse({ number: " ws 123 ", localDate: "2026-11-02" });
    expect(parsed.number).toBe("WS123");
  });

  it("rejects junk input", () => {
    expect(
      AddFlightRequestSchema.safeParse({ number: "hello", localDate: "2026-11-02" }).success,
    ).toBe(false);
    expect(
      AddFlightRequestSchema.safeParse({ number: "AC262", localDate: "next tuesday" }).success,
    ).toBe(false);
  });
});

describe("detectChanges", () => {
  it("returns nothing for the first snapshot", () => {
    expect(detectChanges(undefined, base)).toEqual([]);
  });

  it("flags a delay of 15+ minutes but not a small slip", () => {
    const small = {
      ...base,
      departure: {
        ...base.departure,
        times: { ...base.departure.times, estimated: "2026-11-02T14:10:00Z" },
      },
    };
    const big = {
      ...base,
      departure: {
        ...base.departure,
        times: { ...base.departure.times, estimated: "2026-11-02T14:40:00Z" },
      },
    };
    expect(detectChanges(base, small)).toEqual([]);
    expect(detectChanges(base, big)).toEqual([{ kind: "delay", minutes: 40 }]);
  });

  it("flags a gate change", () => {
    const next = { ...base, departure: { ...base.departure, gate: "12" } };
    expect(detectChanges(base, next)).toEqual([{ kind: "gateChange", from: "8", to: "12" }]);
  });

  it("flags departure and landing once each", () => {
    const departed: Flight = { ...base, status: "en_route" };
    const landed: Flight = { ...base, status: "landed" };
    expect(detectChanges(base, departed)).toEqual([{ kind: "departed" }]);
    expect(detectChanges(departed, landed)).toEqual([{ kind: "landed" }]);
    expect(detectChanges(landed, landed)).toEqual([]);
  });

  it("reports only the cancellation when a flight is cancelled", () => {
    const cancelled: Flight = {
      ...base,
      status: "cancelled",
      departure: { ...base.departure, gate: "12" },
    };
    expect(detectChanges(base, cancelled)).toEqual([{ kind: "cancelled" }]);
  });
});

describe("nextPollAt", () => {
  it("polls daily far out, every 6 h on the last day, every 30 min near departure", () => {
    expect(nextPollAt(base, at("2026-10-30T14:00:00Z"))).toEqual(at("2026-10-31T14:00:00Z"));
    expect(nextPollAt(base, at("2026-11-02T02:00:00Z"))).toEqual(at("2026-11-02T08:00:00Z"));
    expect(nextPollAt(base, at("2026-11-02T12:00:00Z"))).toEqual(at("2026-11-02T12:30:00Z"));
  });

  it("polls hourly in the air and stops once arrived or cancelled", () => {
    expect(nextPollAt({ ...base, status: "en_route" }, at("2026-11-02T15:00:00Z"))).toEqual(
      at("2026-11-02T16:00:00Z"),
    );
    expect(nextPollAt({ ...base, status: "arrived" }, at("2026-11-02T17:00:00Z"))).toBeNull();
    expect(nextPollAt({ ...base, status: "cancelled" }, at("2026-11-02T10:00:00Z"))).toBeNull();
  });
});
