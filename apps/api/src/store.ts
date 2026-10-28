import type { Flight, TrackedFlight } from "@xplorio/core";

/** Storage for users' saved flights and the shared flight cache. Cosmos DB implements this later. */
export interface FlightStore {
  listTracked(userId: string): Promise<TrackedFlight[]>;
  getTracked(userId: string, id: string): Promise<TrackedFlight | undefined>;
  findTrackedByKey(userId: string, flightKey: string): Promise<TrackedFlight | undefined>;
  addTracked(flight: TrackedFlight): Promise<void>;
  removeTracked(userId: string, id: string): Promise<boolean>;

  getCached(flightKey: string): Promise<Flight | undefined>;
  putCached(flight: Flight): Promise<void>;
}

/**
 * In-memory store for local development and the early prototype.
 * Data lives only as long as the process: a restart (or a new Functions instance) starts empty.
 */
export class MemoryFlightStore implements FlightStore {
  private readonly tracked = new Map<string, Map<string, TrackedFlight>>();
  private readonly cache = new Map<string, Flight>();

  private forUser(userId: string): Map<string, TrackedFlight> {
    let m = this.tracked.get(userId);
    if (!m) {
      m = new Map();
      this.tracked.set(userId, m);
    }
    return m;
  }

  async listTracked(userId: string) {
    return [...this.forUser(userId).values()];
  }

  async getTracked(userId: string, id: string) {
    return this.forUser(userId).get(id);
  }

  async findTrackedByKey(userId: string, flightKey: string) {
    return [...this.forUser(userId).values()].find((t) => t.flightKey === flightKey);
  }

  async addTracked(flight: TrackedFlight) {
    this.forUser(flight.userId).set(flight.id, flight);
  }

  async removeTracked(userId: string, id: string) {
    return this.forUser(userId).delete(id);
  }

  async getCached(flightKey: string) {
    return this.cache.get(flightKey);
  }

  async putCached(flight: Flight) {
    this.cache.set(flight.flightKey, flight);
  }
}
