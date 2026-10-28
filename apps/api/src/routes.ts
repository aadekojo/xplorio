import { MockFlightProvider, type FlightDataProvider } from "@xplorio/providers";
import { resolveUserId } from "./auth.js";
import { FlightService } from "./flightService.js";
import {
  created,
  noContent,
  ok,
  toErrorResponse,
  type ApiRequest,
  type ApiResponse,
} from "./http.js";
import { CosmosFlightStore } from "./cosmosStore.js";
import { MemoryFlightStore, type FlightStore } from "./store.js";

function createProvider(): FlightDataProvider {
  const name = process.env.FLIGHT_PROVIDER ?? "mock";
  switch (name) {
    case "mock":
      return new MockFlightProvider();
    default:
      // The AeroDataBox adapter lands in build step 3; until then only the mock exists.
      console.warn(`FLIGHT_PROVIDER=${name} isn't available yet; using the mock provider.`);
      return new MockFlightProvider();
  }
}

/**
 * Cosmos DB when COSMOS_ENDPOINT is set (always, in Azure); otherwise the in-memory store,
 * which is what `pnpm dev` uses and which resets when the process restarts.
 */
function createStore(): { store: FlightStore; kind: "cosmos" | "memory" } {
  const endpoint = process.env.COSMOS_ENDPOINT;
  if (endpoint) {
    return {
      store: CosmosFlightStore.connect(endpoint, process.env.COSMOS_DATABASE ?? "xplorio"),
      kind: "cosmos",
    };
  }
  return { store: new MemoryFlightStore(), kind: "memory" };
}

const { store, kind } = createStore();
export const storeKind = kind;
const service = new FlightService(store, createProvider());

export interface Route {
  /** Azure Functions function name. */
  name: string;
  method: "GET" | "POST" | "DELETE";
  /** Path after /api, Azure Functions route template syntax: flights/{id}. */
  route: string;
  handler: (req: ApiRequest) => Promise<ApiResponse>;
}

const id = (req: ApiRequest) => req.params.id ?? "";

export const routes: Route[] = [
  {
    name: "listFlights",
    method: "GET",
    route: "flights",
    handler: async (req) => ok(await service.list(resolveUserId(req))),
  },
  {
    name: "addFlight",
    method: "POST",
    route: "flights",
    handler: async (req) => created(await service.add(resolveUserId(req), req.body)),
  },
  {
    name: "getFlight",
    method: "GET",
    route: "flights/{id}",
    handler: async (req) => ok(await service.get(resolveUserId(req), id(req))),
  },
  {
    name: "removeFlight",
    method: "DELETE",
    route: "flights/{id}",
    handler: async (req) => {
      await service.remove(resolveUserId(req), id(req));
      return noContent();
    },
  },
];

/** Runs a route's handler and converts any thrown error into a JSON error response. */
export async function run(route: Route, req: ApiRequest): Promise<ApiResponse> {
  try {
    return await route.handler(req);
  } catch (err) {
    return toErrorResponse(err);
  }
}
