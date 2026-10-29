# Xplorio

A personal flight tracker: add a flight by number and date, watch its live status and route, and get alerts for delays, gate changes, departure and landing.

> **Project archived (October 2026).** Xplorio was built over a short sprint as a hands-on cloud and DevOps project and is no longer in development. All Azure resources and the dedicated subscription have been deleted, so `xp.example.com` and the API are offline. The code is kept here as a reference.

## What this project demonstrates

- **Infrastructure as code:** every Azure resource in Bicep (`infra/`): Azure Functions (Flex Consumption), Cosmos DB for NoSQL, Key Vault, Static Web Apps, Log Analytics and Application Insights, plus a subscription budget alert. Separate `prod` and `test` environments, one resource group each, driven by parameter files.
- **Keyless, least-privilege security:** GitHub Actions deploys to Azure with OIDC federated credentials, so no cloud secrets are stored in GitHub. Each environment has its own deploy identity scoped to its own resource group, and an ABAC condition limits it to granting five specific roles. Storage shared keys, Cosmos keys and App Insights local auth are all disabled; the API reaches everything through one user-assigned managed identity.
- **CI/CD:** format, lint, type-check, tests and build on every push, plus a dependency audit, a gitleaks secret scan and Dependabot. Deploy workflows for infrastructure (with what-if), the API (with a health-check smoke test) and the web app.
- **A typed TypeScript monorepo:** pnpm + Turborepo, with shared domain types, zod validation and tested business rules (alert detection, a polling schedule designed around a 600-unit/month API quota) used by both the API and the app.
- **A testable API:** framework-neutral handlers that run under Azure Functions and a local hot-reload dev server, with a storage interface implemented for both memory and Cosmos DB and covered by the same contract tests.
- **Supply-chain hygiene:** pnpm's minimum release age (no same-day package versions) and a pinned package manager.

## State when archived

- **Built:** monorepo and CI; Azure infrastructure for prod; Expo Router + Tamagui web app (My flights, Add flight, Flight detail) on a deterministic mock flight provider; API endpoints for listing, adding, viewing and removing flights; Cosmos DB storage.
- **Not built:** real flight data (AeroDataBox adapter), sign-in (Entra External ID), push alerts, route map and history.
- **Unresolved:** the deployed web app couldn't load flights from the Cosmos-backed API; the cause wasn't diagnosed before the project was archived.
- **Lessons:** Expo-for-web traded web quality for a shared codebase that would only pay off if the iOS app shipped. For a web-first product, a dedicated web app (for example Vite + React) on the same API and shared packages would be the better fit, with a native app added later if needed. The planning, history and gotchas are in [CLAUDE.md](CLAUDE.md).

The sections below describe the project as it was while in development.

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
