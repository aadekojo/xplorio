import { CosmosClient, ErrorResponse, type Container } from "@azure/cosmos";
import {
  DefaultAzureCredential,
  ManagedIdentityCredential,
  type TokenCredential,
} from "@azure/identity";
import {
  bestTime,
  FlightSchema,
  TrackedFlightSchema,
  type Flight,
  type TrackedFlight,
} from "@xplorio/core";
import type { FlightStore } from "./store.js";

const DAY_S = 24 * 60 * 60;

/** Keep cached flight status for 30 days after arrival, then let Cosmos expire it (TTL). */
export const CACHE_RETENTION_DAYS = 30;

/** Shape of a document in the flightCache container (partition key /flightKey). */
export interface FlightCacheDoc {
  id: string;
  flightKey: string;
  flight: Flight;
  /** Seconds until Cosmos deletes the document. The container has TTL on with no default. */
  ttl: number;
}

/** Seconds until a cached flight should expire: 30 days after its arrival, at least one day. */
export function cacheTtlSeconds(flight: Flight, now: Date = new Date()): number {
  const arrival = bestTime(flight.arrival) ?? bestTime(flight.departure);
  if (!arrival) return 60 * DAY_S;
  const expiresMs = Date.parse(arrival) + CACHE_RETENTION_DAYS * DAY_S * 1000;
  return Math.max(DAY_S, Math.ceil((expiresMs - now.getTime()) / 1000));
}

export function toCacheDoc(flight: Flight, now: Date = new Date()): FlightCacheDoc {
  return {
    id: flight.flightKey,
    flightKey: flight.flightKey,
    flight,
    ttl: cacheTtlSeconds(flight, now),
  };
}

/**
 * Validates documents coming back from Cosmos and drops its system fields (_rid, _etag, _ts…),
 * so nothing unexpected flows into API responses.
 */
export function fromTrackedDoc(doc: unknown): TrackedFlight {
  return TrackedFlightSchema.parse(doc);
}

export function fromCacheDoc(doc: unknown): Flight {
  return FlightSchema.parse((doc as FlightCacheDoc).flight);
}

/**
 * In Azure the Function App's user-assigned identity is used directly (AZURE_CLIENT_ID).
 * Locally, DefaultAzureCredential picks up `az login`.
 */
function credential(): TokenCredential {
  const clientId = process.env.AZURE_CLIENT_ID;
  return clientId ? new ManagedIdentityCredential({ clientId }) : new DefaultAzureCredential();
}

const isNotFound = (err: unknown) => err instanceof ErrorResponse && err.code === 404;

/**
 * Cosmos DB implementation of FlightStore. Keys are disabled on the account, so access is
 * Entra-only through the API's managed identity. Every user query is scoped to that user's
 * partition, so one user can never read another user's flights.
 */
export class CosmosFlightStore implements FlightStore {
  constructor(
    private readonly tracked: Container,
    private readonly cache: Container,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  /** Connects to the account with Entra auth; the containers are created by infra/modules/cosmos.bicep. */
  static connect(endpoint: string, databaseName: string): CosmosFlightStore {
    const client = new CosmosClient({ endpoint, aadCredentials: credential() });
    const db = client.database(databaseName);
    return new CosmosFlightStore(db.container("trackedFlights"), db.container("flightCache"));
  }

  async listTracked(userId: string): Promise<TrackedFlight[]> {
    const { resources } = await this.tracked.items
      .query(
        {
          query: "SELECT * FROM c WHERE c.userId = @userId",
          parameters: [{ name: "@userId", value: userId }],
        },
        { partitionKey: userId },
      )
      .fetchAll();
    return resources.map(fromTrackedDoc);
  }

  async getTracked(userId: string, id: string): Promise<TrackedFlight | undefined> {
    const { resource } = await this.tracked.item(id, userId).read();
    return resource ? fromTrackedDoc(resource) : undefined;
  }

  async findTrackedByKey(userId: string, flightKey: string): Promise<TrackedFlight | undefined> {
    const { resources } = await this.tracked.items
      .query(
        {
          query: "SELECT * FROM c WHERE c.userId = @userId AND c.flightKey = @flightKey",
          parameters: [
            { name: "@userId", value: userId },
            { name: "@flightKey", value: flightKey },
          ],
        },
        { partitionKey: userId },
      )
      .fetchAll();
    return resources[0] ? fromTrackedDoc(resources[0]) : undefined;
  }

  async addTracked(flight: TrackedFlight): Promise<void> {
    await this.tracked.items.create(flight);
  }

  async removeTracked(userId: string, id: string): Promise<boolean> {
    try {
      await this.tracked.item(id, userId).delete();
      return true;
    } catch (err) {
      if (isNotFound(err)) return false;
      throw err;
    }
  }

  async getCached(flightKey: string): Promise<Flight | undefined> {
    const { resource } = await this.cache.item(flightKey, flightKey).read();
    return resource ? fromCacheDoc(resource) : undefined;
  }

  async putCached(flight: Flight): Promise<void> {
    await this.cache.items.upsert(toCacheDoc(flight, this.clock()));
  }
}
