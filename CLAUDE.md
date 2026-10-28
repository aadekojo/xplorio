# CLAUDE.md

Context for Claude (and any other contributor) working on this repo. Read this first, then update the **Status** section at the end of every working session.

## What Xplorio is

A personal flight tracker inspired by Flighty: add a flight by number and date, see live status, gate, delay and route, and get alerts. Built for the owner first, with security in place so a few invited friends can use it later.

- **Owner:** Adekojo Abimbola (GitHub `aadekojo`)
- **Working name:** Xplorio (may be renamed; keep the name in few places, see Conventions)
- **URL:** https://xp.example.com (Cloudflare DNS for `example.com`)
- **Repo:** private GitHub repo, local copy at `~/Documents/01-projects/Xplorio`
- **Design doc:** [Flight Tracker MVP Design](https://claude.ai/artifact/T6WnBzDmydtAScruB8cvqE) (scope, architecture diagram, data model, security, costs)

## Decisions made

| Topic        | Decision                                                                                            |
| ------------ | --------------------------------------------------------------------------------------------------- |
| Platform     | **Web app only for now.** iOS is on the back burner, but the code must stay iOS-ready (Expo).       |
| Repo         | One pnpm + Turborepo monorepo so web and (later) iOS share one codebase                             |
| App          | Expo + Expo Router + react-native-web, styled with **Tamagui**                                      |
| API          | Azure Functions (Flex Consumption), Node 22, TypeScript, v4 programming model, bundled with esbuild |
| Database     | Cosmos DB for NoSQL, **free tier**, Canada Central                                                  |
| Auth         | Microsoft Entra External ID, **email one-time code**, invite-only sign-up                           |
| Secrets      | Azure Key Vault + Function App managed identity                                                     |
| Hosting      | Azure Static Web Apps (Free) behind Cloudflare                                                      |
| IaC / deploy | Bicep in `infra/`, GitHub Actions with OIDC federated credentials (no stored Azure secrets)         |
| Flight data  | AeroDataBox via API.Market, **free Basic plan** for testing, behind a provider adapter              |
| Push alerts  | Web Push (VAPID)                                                                                    |

## Flight data budget (important)

AeroDataBox free Basic plan: **600 API units and 2,400 requests per month, 1 request/second.**

- Unit cost by endpoint tier: Tier 1 = 1, **Tier 2 = 2 (flight status)**, Tier 3 = 6.
- One flight-status lookup = 2 units, so the free plan covers about 300 lookups, roughly 17 tracked flights a month.
- Polling schedule per flight (about 17 lookups) lives in `packages/core/src/rules.ts` (`nextPollAt`).
- Never put Tier 3 endpoints (e.g. delay statistics) in the polling loop.
- **Develop against the mock provider** (`FLIGHT_PROVIDER=mock`); spend real units only on real flights.
- Planned: a budget guard that stops polling at 90% of monthly units, and a shared `flightCache` so two users tracking one flight cost one schedule.

## Repo layout

```
apps/app/            Expo app (placeholder until step 5)
apps/api/            Azure Functions API; build.mjs bundles to dist/index.js
packages/core/       Domain types + zod schemas (schemas.ts), alert and polling rules (rules.ts)
packages/providers/  FlightDataProvider interface + MockFlightProvider (AeroDataBox adapter next)
packages/api-client/ Typed fetch client for the app
packages/config/     Shared tsconfig
infra/               Bicep (placeholder until step 2)
.github/             ci.yml, codeql.yml (public repos only), dependabot.yml
```

## Commands

```sh
corepack enable          # once, to get the pinned pnpm
pnpm install
pnpm lint | pnpm typecheck | pnpm test | pnpm build
pnpm format              # Prettier; CI runs format:check
pnpm --filter @xplorio/api build && (cd apps/api && func start)   # local API on :7071
```

CI (`.github/workflows/ci.yml`) runs format check, lint, typecheck, test and build, plus `pnpm audit --prod --audit-level high` and a gitleaks secret scan. All must pass before merging.

## Conventions

- TypeScript strict everywhere (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`).
- Shared types and validation live in `packages/core`; the app and API import them, never duplicate them.
- Workspace packages export TypeScript source (`"exports": "./src/index.ts"`); the API is bundled by esbuild, so it needs no build step for them.
- New flight data sources implement `FlightDataProvider` in `packages/providers`.
- Package scope `@xplorio/*`. App name appears only in package scope, app config and the Bicep `appName` parameter so a rename stays cheap.
- Tests sit next to the code as `*.test.ts` (Vitest). Pure logic (rules, schemas) gets tests first.

## Security rules (non-negotiable)

- The API is the only thing that touches secrets, the database or the flight provider. The app never sees the provider key.
- The user ID always comes from the validated token, never from the request body or query. Every Cosmos query is scoped to that user's partition.
- Store only what the app needs: flight number, date, nickname, alert settings, email. No booking references, seats, passport or loyalty numbers.
- Logs carry request IDs and user IDs, never emails, tokens or push keys.
- `local.settings.json` and `.env*` are git-ignored; never commit secrets. Use `local.settings.example.json` as the template.
- Data stays in Canada Central.

## Gotchas learned so far

- **Private repo on a free GitHub plan:** CodeQL code scanning, GitHub secret scanning and branch protection are not available. CI uses gitleaks + `pnpm audit` + Dependabot instead; `codeql.yml` only runs if the repo becomes public. The design doc's security table still lists the paid features and should be updated.
- **`@azure/functions-core`** is injected by the Functions host and must stay `external` in `apps/api/build.mjs`.
- **esbuild** needs its install script, allowed via `pnpm.onlyBuiltDependencies` in the root `package.json`.
- **Cosmos free tier** must be enabled when the account is created; it can't be turned on later.
- **Cloudflare + Static Web Apps custom domain:** keep the `xp` CNAME DNS-only (grey cloud) until Azure validates the domain and issues the certificate, then proxy it.
- **Working in the owner's folder from Claude:** file deletion is not permitted there. Don't delete files; tell the owner what to remove. The owner runs git commits and pushes.

## Build order

1. Repo and pipeline
2. Infrastructure: Bicep for Static Web App, Function App, Cosmos (free tier), Key Vault, App Insights; GitHub OIDC to Azure
3. Core and providers: AeroDataBox adapter behind `FlightDataProvider`
4. Auth: External ID tenant, app registration, invite allow-list, token validation middleware, sign-in screen
5. Add and view a flight: Expo app with Tamagui, status card, flight list; first deploy to xp.example.com
6. Polling and cache: timer function, shared `flightCache`, budget guard, rate limits
7. Map and history: MapLibre route map, past flights, stats
8. Alerts: Web Push subscription, change detection, notifications
9. Privacy features: delete account, export data, privacy page; then invite friends
10. iOS (back burner): Apple Developer account, EAS build, TestFlight, APNs, Live Activities

## Status

_Last updated: 2026-10-28_

- **Done:** Step 1. Monorepo scaffolded and verified (format, lint, typecheck, 14 tests, API build, clean audit). Initial commit made on `main`.
- **Also done early:** `packages/core` schemas and rules (alert detection, polling schedule) with tests; `packages/providers` interface and mock provider; `/api/health` endpoint; typed api-client stub.
- **In progress:** Pushing to the private GitHub repo.
- **Next:** Step 2, infrastructure (Bicep + OIDC deploy workflows).
- **Open items:** Update the design doc's security section for the free-plan GitHub limits. Remove the leftover `../xplorio-scaffold.tgz` archive in `01-projects`.
