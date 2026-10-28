import {
  AddFlightRequestSchema,
  AlertPrefsSchema,
  bestTime,
  flightKey,
  nextPollAt,
  type Flight,
  type TrackedFlight,
  type TrackedFlightView,
} from "@xplorio/core";
import type { FlightDataProvider } from "@xplorio/providers";
import { HttpError } from "./http.js";
import type { FlightStore } from "./store.js";

const DAY = 24 * 60 * 60 * 1000;

/** Caps that protect the API quota once real flight data is switched on. */
export const LIMITS = {
  maxTrackedPerUser: 50,
  maxDaysAhead: 365,
  maxDaysBehind: 30,
  /** Free providers (the mock) refresh this often so the UI feels live while designing. */
  freeProviderRefreshMs: 30_000,
};

export class FlightService {
  constructor(
    private readonly store: FlightStore,
    private readonly provider: FlightDataProvider,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async list(userId: string): Promise<TrackedFlightView[]> {
    const tracked = await this.store.listTracked(userId);
    const views = await Promise.all(tracked.map((t) => this.view(t)));
    return views.sort((a, b) => departureMs(a) - departureMs(b));
  }

  async get(userId: string, id: string): Promise<TrackedFlightView> {
    const tracked = await this.store.getTracked(userId, id);
    if (!tracked) throw new HttpError(404, "That flight isn't in your list.");
    return this.view(tracked);
  }

  async add(userId: string, body: unknown): Promise<TrackedFlightView> {
    const parsed = AddFlightRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpError(
        400,
        parsed.error.issues[0]?.message ?? "Check the flight number and date.",
      );
    }
    const { number, localDate, nickname, legIndex = 0 } = parsed.data;

    const now = this.clock().getTime();
    const day = Date.parse(`${localDate}T00:00:00Z`);
    if (day > now + LIMITS.maxDaysAhead * DAY || day < now - LIMITS.maxDaysBehind * DAY) {
      throw new HttpError(400, "Pick a date within the past month or the next year.");
    }

    const existing = await this.store.listTracked(userId);
    if (existing.length >= LIMITS.maxTrackedPerUser) {
      throw new HttpError(400, `You can track up to ${LIMITS.maxTrackedPerUser} flights.`);
    }
    const key = flightKey(number, localDate, legIndex);
    if (await this.store.findTrackedByKey(userId, key)) {
      throw new HttpError(409, `You're already tracking ${number} on ${localDate}.`);
    }

    const legs = await this.provider.getFlights(number, localDate);
    if (legs.length === 0) {
      throw new HttpError(404, `We couldn't find ${number} on ${localDate}.`);
    }
    const leg = legs[legIndex];
    if (!leg) throw new HttpError(400, `${number} has ${legs.length} leg(s) that day.`);
    const flight: Flight = { ...leg, flightKey: key };
    await this.store.putCached(flight);

    const tracked: TrackedFlight = {
      id: crypto.randomUUID(),
      userId,
      flightKey: key,
      number,
      localDate,
      ...(nickname && { nickname }),
      alerts: AlertPrefsSchema.parse({}),
      createdAt: new Date(now).toISOString(),
    };
    await this.store.addTracked(tracked);
    return { tracked, flight };
  }

  async remove(userId: string, id: string): Promise<void> {
    if (!(await this.store.removeTracked(userId, id))) {
      throw new HttpError(404, "That flight isn't in your list.");
    }
  }

  /** The tracked entry plus the cached flight, refreshed from the provider when it's due. */
  private async view(tracked: TrackedFlight): Promise<TrackedFlightView> {
    const cached = await this.store.getCached(tracked.flightKey);
    if (cached && !this.isStale(cached)) return { tracked, flight: cached };

    try {
      const legs = await this.provider.getFlights(tracked.number, tracked.localDate);
      const legIndex = Number(tracked.flightKey.split("_")[2] ?? 0);
      const leg = legs[legIndex];
      if (!leg) return { tracked, flight: cached ?? null };
      const flight: Flight = { ...leg, flightKey: tracked.flightKey };
      await this.store.putCached(flight);
      return { tracked, flight };
    } catch (err) {
      // Serve the last known status rather than failing the whole list.
      console.error(err);
      return { tracked, flight: cached ?? null };
    }
  }

  private isStale(flight: Flight): boolean {
    const now = this.clock().getTime();
    const fetched = Date.parse(flight.fetchedAt);
    if (this.provider.unitsPerLookup === 0) {
      return now - fetched > LIMITS.freeProviderRefreshMs;
    }
    const next = nextPollAt(flight, new Date(fetched));
    return next !== null && now >= next.getTime();
  }
}

function departureMs(v: TrackedFlightView): number {
  const t = v.flight ? bestTime(v.flight.departure) : undefined;
  return t ? Date.parse(t) : Date.parse(`${v.tracked.localDate}T00:00:00Z`);
}
