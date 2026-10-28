import type { HttpResponseInit } from "@azure/functions";

/** Liveness probe body. Anonymous on purpose and returns nothing sensitive. */
export function health(now: Date = new Date(), store?: string): HttpResponseInit {
  return {
    status: 200,
    headers: { "Cache-Control": "no-store" },
    jsonBody: {
      status: "ok",
      service: "xplorio-api",
      time: now.toISOString(),
      ...(store && { store }),
    },
  };
}
