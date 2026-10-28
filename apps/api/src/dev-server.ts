// Local API for development: `pnpm dev` (root) or `pnpm --filter @xplorio/api dev`.
// Serves the same handlers as Azure Functions on http://localhost:7071/api, with hot reload
// via tsx watch and no Azure Functions Core Tools needed.
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { ApiRequest } from "./http.js";
import { routes, run, storeKind, type Route } from "./routes.js";
import { health } from "./health.js";

const PORT = Number(process.env.PORT ?? 7071);
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? "http://localhost:8081").split(",");

function match(route: Route, method: string, path: string): Record<string, string> | null {
  if (route.method !== method) return null;
  const want = route.route.split("/");
  const got = path.split("/").filter(Boolean);
  if (want.length !== got.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < want.length; i++) {
    const w = want[i]!;
    const g = decodeURIComponent(got[i]!);
    if (w.startsWith("{") && w.endsWith("}")) params[w.slice(1, -1)] = g;
    else if (w !== g) return null;
  }
  return params;
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const text = Buffer.concat(chunks).toString("utf8");
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function send(res: ServerResponse, status: number, body?: unknown) {
  res.statusCode = status;
  res.setHeader("Cache-Control", "no-store");
  if (body === undefined) return res.end();
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

const server = createServer(async (req, res) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
  }
  if (req.method === "OPTIONS") return send(res, 204);

  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  if (!url.pathname.startsWith("/api/")) return send(res, 404, { error: "Not found" });
  const path = url.pathname.slice("/api/".length);
  const method = req.method ?? "GET";

  if (method === "GET" && path === "health") {
    const h = health(new Date(), storeKind);
    return send(res, h.status ?? 200, h.jsonBody);
  }

  for (const route of routes) {
    const params = match(route, method, path);
    if (!params) continue;
    const apiReq: ApiRequest = {
      method,
      params,
      query: url.searchParams,
      headers: new Headers(req.headers as Record<string, string>),
      body: await readBody(req),
    };
    const out = await run(route, apiReq);
    console.warn(`${method} /api/${path} -> ${out.status}`);
    return send(res, out.status, out.body);
  }
  send(res, 404, { error: "Not found" });
});

server.listen(PORT, () => {
  console.warn(
    `Xplorio API (dev) on http://localhost:${PORT}/api  provider=${process.env.FLIGHT_PROVIDER ?? "mock"} store=${storeKind}`,
  );
});
