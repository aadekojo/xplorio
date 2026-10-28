import type { Flight, FlightEndpoint } from "./schemas.js";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** Cache key shared by everyone tracking the same flight on the same day. */
export function flightKey(number: string, localDate: string, legIndex = 0): string {
  const base = `${number.toUpperCase()}_${localDate}`;
  return legIndex > 0 ? `${base}_${legIndex}` : base;
}

/** Best known time for one end of a flight: actual, then estimated, then scheduled. */
export function bestTime(endpoint: FlightEndpoint): string | undefined {
  const t = endpoint.times;
  return t.actual ?? t.estimated ?? t.scheduled;
}

/** Departure delay in whole minutes (negative = early). Undefined when times are missing. */
export function departureDelayMinutes(flight: Flight): number | undefined {
  const scheduled = flight.departure.times.scheduled;
  const best = bestTime(flight.departure);
  if (!scheduled || !best) return undefined;
  return Math.round((Date.parse(best) - Date.parse(scheduled)) / MINUTE);
}

export type FlightChange =
  | { kind: "delay"; minutes: number }
  | { kind: "gateChange"; from: string | undefined; to: string }
  | { kind: "departed" }
  | { kind: "landed" }
  | { kind: "cancelled" };

/** A delay alert fires when the delay grows by at least this many minutes. */
export const DELAY_ALERT_THRESHOLD_MIN = 15;

const DEPARTED = new Set(["departed", "en_route", "landed", "arrived"]);
const LANDED = new Set(["landed", "arrived"]);

/**
 * Compares the previous and latest snapshot of a flight and returns the changes worth a push alert.
 * Pure function so the poller and the webhook share one definition of "meaningful".
 */
export function detectChanges(prev: Flight | undefined, next: Flight): FlightChange[] {
  if (!prev) return [];
  const changes: FlightChange[] = [];

  if (next.status === "cancelled" && prev.status !== "cancelled") {
    changes.push({ kind: "cancelled" });
    return changes;
  }

  const before = departureDelayMinutes(prev) ?? 0;
  const after = departureDelayMinutes(next) ?? 0;
  if (after - before >= DELAY_ALERT_THRESHOLD_MIN) {
    changes.push({ kind: "delay", minutes: after });
  }

  const newGate = next.departure.gate;
  if (newGate && newGate !== prev.departure.gate) {
    changes.push({ kind: "gateChange", from: prev.departure.gate, to: newGate });
  }

  if (DEPARTED.has(next.status) && !DEPARTED.has(prev.status)) {
    changes.push({ kind: "departed" });
  }
  if (LANDED.has(next.status) && !LANDED.has(prev.status)) {
    changes.push({ kind: "landed" });
  }

  return changes;
}

/**
 * When to look this flight up again, or null to stop polling.
 * Mirrors the budget in the design doc: about 17 lookups per flight
 * (daily far out, every 6 h on the last day, every 30 min in the last 3 h, hourly in the air).
 */
export function nextPollAt(flight: Flight, now: Date): Date | null {
  if (flight.status === "cancelled" || flight.status === "arrived") return null;
  if (flight.status === "landed") {
    // One confirmation lookup to pick up the actual arrival time and belt.
    return new Date(now.getTime() + HOUR);
  }

  const nowMs = now.getTime();
  if (DEPARTED.has(flight.status)) {
    const arrival = bestTime(flight.arrival);
    if (arrival && Date.parse(arrival) < nowMs - 6 * HOUR) return null; // stale; stop spending units
    return new Date(nowMs + HOUR);
  }

  const departure = bestTime(flight.departure);
  if (!departure) return new Date(nowMs + 24 * HOUR);
  const untilDeparture = Date.parse(departure) - nowMs;

  if (untilDeparture > 24 * HOUR) return new Date(nowMs + 24 * HOUR);
  if (untilDeparture > 3 * HOUR) return new Date(nowMs + 6 * HOUR);
  if (untilDeparture > -2 * HOUR) return new Date(nowMs + 30 * MINUTE);
  // Two hours past departure with no departed status: check hourly until the provider catches up.
  return new Date(nowMs + HOUR);
}
