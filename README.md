# Xplorio

A personal flight tracker: add a flight by number and date, watch its live status and route, and get alerts for delays, gate changes, departure and landing.

Web first at **https://xp.adekojo.cloud**, iOS later from the same codebase.

## Repo layout

```
apps/
  app/           Expo Router + Tamagui app (web now, iOS later)
  api/           Azure Functions API (TypeScript)
packages/
  core/          Domain types, zod schemas, status and polling rules
  providers/     FlightDataProvider interface + mock adapter (AeroDataBox next)
  api-client/    Typed fetch client for the app
  config/        Shared TypeScript config
infra/           Bicep for all Azure resources           - build step 2
.github/         CI, CodeQL (public only), Dependabot
```

## Getting started

Requires Node 22+ and pnpm (via Corepack).

```sh
corepack enable
pnpm install
pnpm dev         # app on http://localhost:8081, API on http://localhost:7071/api, both hot-reload
```

Open http://localhost:8081 and add a flight. Everything runs on the **mock flight provider**, so no real API units are spent: any flight number gets a stable sample route and times, numbers ending in `D` run 45 minutes late, and numbers ending in `X` are cancelled. Saved flights live in memory, so restarting the API clears them.

Other commands:

```sh
pnpm test        # all packages
pnpm typecheck
pnpm lint
pnpm format      # Prettier (CI runs format:check)
pnpm build       # API bundle + web export
```

To run the API under the real Azure Functions host instead of the dev server (needs [Azure Functions Core Tools](https://learn.microsoft.com/azure/azure-functions/functions-run-local) v4):

```sh
cp apps/api/local.settings.example.json apps/api/local.settings.json
pnpm --filter @xplorio/api build
cd apps/api && func start
```

## Build order

1. Repo and pipeline (done)
2. Infrastructure (Bicep, OIDC deploys): code in infra/, see infra/README.md
3. Core and providers (AeroDataBox adapter)
4. Auth (Entra External ID, email one-time code, invite-only)
5. Add and view a flight (screens built on mock data; deploy pending)
6. Polling, cache and budget guard
7. Map and history
8. Alerts (Web Push)
9. Privacy features (delete account, export data), then invite friends

See [SECURITY.md](SECURITY.md) for the security model.
