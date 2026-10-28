import type { AddFlightRequest, Flight, TrackedFlight } from "@xplorio/core";

export interface ApiClientOptions {
  /** e.g. "https://xp.adekojo.cloud/api" in production, "http://localhost:7071/api" locally. */
  baseUrl: string;
  /** Returns a fresh access token from the sign-in library, or undefined when signed out. */
  getAccessToken: () => Promise<string | undefined>;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface TrackedFlightWithStatus {
  tracked: TrackedFlight;
  flight: Flight | null;
}

/** Thin typed wrapper over fetch. Endpoints are filled in as the API grows (build steps 4-8). */
export function createApiClient({ baseUrl, getAccessToken }: ApiClientOptions) {
  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = await getAccessToken();
    const headers = new Headers(init.headers);
    headers.set("Accept", "application/json");
    if (init.body) headers.set("Content-Type", "application/json");
    if (token) headers.set("Authorization", `Bearer ${token}`);

    const res = await fetch(`${baseUrl}${path}`, { ...init, headers });
    if (!res.ok) {
      throw new ApiError(res.status, `${init.method ?? "GET"} ${path} failed with ${res.status}`);
    }
    return (res.status === 204 ? undefined : await res.json()) as T;
  }

  return {
    health: () => request<{ status: string; time: string }>("/health"),
    listFlights: () => request<TrackedFlightWithStatus[]>("/flights"),
    addFlight: (body: AddFlightRequest) =>
      request<TrackedFlightWithStatus>("/flights", { method: "POST", body: JSON.stringify(body) }),
    removeFlight: (id: string) =>
      request<void>(`/flights/${encodeURIComponent(id)}`, { method: "DELETE" }),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
