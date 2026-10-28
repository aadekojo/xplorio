import { app, type HttpRequest } from "@azure/functions";
import type { ApiRequest } from "../http.js";
import { routes, run } from "../routes.js";

async function toApiRequest(req: HttpRequest): Promise<ApiRequest> {
  const text = await req.text();
  let body: unknown;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = undefined;
    }
  }
  return {
    method: req.method,
    params: req.params,
    query: new URLSearchParams(req.query),
    headers: new Headers(req.headers),
    body,
  };
}

// Functions shares one name per HTTP function, so each (method, route) pair is registered separately.
for (const route of routes) {
  app.http(route.name, {
    methods: [route.method],
    authLevel: "anonymous",
    route: route.route,
    handler: async (req) => {
      const res = await run(route, await toApiRequest(req));
      return {
        status: res.status,
        headers: { "Cache-Control": "no-store" },
        ...(res.body !== undefined && { jsonBody: res.body }),
      };
    },
  });
}
