import { app, type HttpResponseInit } from "@azure/functions";

/** Liveness probe. Anonymous on purpose and returns nothing sensitive. */
export function health(now: Date = new Date()): HttpResponseInit {
  return {
    status: 200,
    headers: { "Cache-Control": "no-store" },
    jsonBody: {
      status: "ok",
      service: "xplorio-api",
      time: now.toISOString(),
    },
  };
}

app.http("health", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "health",
  handler: async () => health(),
});
