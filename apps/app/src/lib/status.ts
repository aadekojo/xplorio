import { bestTime, type Flight } from "@xplorio/core";
import { minutesLate } from "./format";

export type Tone = "neutral" | "good" | "warn" | "bad" | "live";

export interface StatusMeta {
  label: string;
  tone: Tone;
}

/** How a flight's status reads to a person, and the colour it gets. */
export function statusMeta(flight: Flight): StatusMeta {
  const late = minutesLate(flight.departure.times.scheduled, bestTime(flight.departure));
  switch (flight.status) {
    case "cancelled":
      return { label: "Cancelled", tone: "bad" };
    case "diverted":
      return { label: "Diverted", tone: "bad" };
    case "boarding":
      return { label: "Boarding", tone: "live" };
    case "departed":
    case "en_route":
      return { label: "In the air", tone: "live" };
    case "landed":
      return { label: "Landed", tone: "good" };
    case "arrived":
      return { label: "Arrived", tone: "good" };
    case "delayed":
      return { label: late > 0 ? `Delayed ${late}m` : "Delayed", tone: "warn" };
    case "scheduled":
      return late >= 15
        ? { label: `Delayed ${late}m`, tone: "warn" }
        : { label: "On time", tone: "good" };
    default:
      return { label: "Unknown", tone: "neutral" };
  }
}

/** Tamagui sub-theme for each tone (the default v6 config ships green, yellow, red, accent). */
export const toneTheme: Record<Tone, "green" | "yellow" | "red" | "accent" | undefined> = {
  neutral: undefined,
  good: "green",
  warn: "yellow",
  bad: "red",
  live: "accent",
};

/** True once the flight has left the gate or later. */
export function hasDeparted(flight: Flight): boolean {
  return ["departed", "en_route", "landed", "arrived"].includes(flight.status);
}

/** True when the flight is over: arrived, landed, or cancelled. */
export function isFinished(flight: Flight): boolean {
  return ["landed", "arrived", "cancelled"].includes(flight.status);
}

/** 0..1 share of the flight completed, for the progress line. */
export function progress(flight: Flight, nowMs: number): number {
  if (flight.status === "landed" || flight.status === "arrived") return 1;
  if (!hasDeparted(flight)) return 0;
  const dep = bestTime(flight.departure);
  const arr = bestTime(flight.arrival);
  if (!dep || !arr) return 0.5;
  const t = (nowMs - Date.parse(dep)) / (Date.parse(arr) - Date.parse(dep));
  return Math.min(1, Math.max(0, t));
}
