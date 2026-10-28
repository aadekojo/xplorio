# CLAUDE.md

Context for Claude (and any other contributor) working on this repo. Read this first, then update the **Status** section at the end of every working session.

## What Xplorio is

A personal flight tracker inspired by Flighty: add a flight by number and date, see live status, gate, delay and route, and get alerts. Built for the owner first, with security in place so a few invited friends can use it later.

- **Owner:** Adekojo Abimbola (GitHub `aadekojo`)
- **Working name:** Xplorio (may be renamed; keep the name in few places, see Conventions)
- **URLs:** prod https://xp.adekojo.cloud, test https://xp-test.adekojo.cloud (Cloudflare DNS for `adekojo.cloud`)
- **Repo:** private GitHub repo, local copy at `~/Documents/01-projects/Xplorio`
- **Design doc:** [Flight Tracker MVP Design](https://claude.ai/artifact/T6WnBzDmydtAScruB8cvqE) (scope, architecture diagram, data model, security, costs). **Don't update the design doc unless the owner asks.**

## Decisions made

| Topic        | Decision                                                                                                                                                                                                                                                                  |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Platform     | **Web app only for now.** iOS is on the back burner, but the code must stay iOS-ready (Expo).                                                                                                                                                                             |
| Repo         | One pnpm + Turborepo monorepo so web and (later) iOS share one codebase                                                                                                                                                                                                   |
| App          | Expo + Expo Router + react-native-web, styled with **Tamagui**                                                                                                                                                                                                            |
| API          | Azure Functions (Flex Consumption), Node 22, TypeScript, v4 programming model, bundled with esbuild                                                                                                                                                                       |
| Database     | Cosmos DB for NoSQL, **free tier**, Canada Central                                                                                                                                                                                                                        |
| Auth         | Microsoft Entra External ID, **email one-time code**, invite-only sign-up                                                                                                                                                                                                 |
| Secrets      | Azure Key Vault + Function App managed identity                                                                                                                                                                                                                           |
| Hosting      | Azure Static Web Apps (Free) behind Cloudflare                                                                                                                                                                                                                            |
| IaC / deploy | Bicep in `infra/`, GitHub Actions with OIDC federated credentials (no stored Azure secrets)                                                                                                                                                                               |
| Azure        | **Dedicated `xplorio` subscription**, Canada Central, two resource groups: `rg-xplorio-prod`, `rg-xplorio-test`                                                                                                                                                           |
| Environments | **prod** at `xp.adekojo.cloud` is the only one in use; pushes to `main` auto-deploy to prod. **test** at `xp-test.adekojo.cloud` is defined in code but not set up yet. Later: set repo variable `AUTO_DEPLOY_ENV=test` so pushes go to test and prod becomes manual-only |
| Flight data  | AeroDataBox via API.Market, **free Basic plan** for testing, behind a provider adapter                                                                                                                                                                                    |
| Push alerts  | Web Push (VAPID)                                                                                                                                                                                                                                                          |

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
apps/app/placeholder Coming-soon page + staticwebapp.config.json (security headers) until step 5
infra/               main.bicep + modules/, env/prod.bicepparam + env/test.bicepparam, bootstrap/ (per-env setup, budget)
.github/             ci.yml, infra.yml, deploy-api.yml, deploy-web.yml, codeql.yml (public only), dependabot.yml
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
- **Static Web Apps isn't offered in Canadian regions.** Its metadata lives in Central US; it stores only static files, no user data. Everything else is in Canada Central.
- **Flex Consumption apps take no `FUNCTIONS_WORKER_RUNTIME` / `FUNCTIONS_EXTENSION_VERSION` settings**; the runtime is set in `functionAppConfig`. Max instance count can't go below 40.
- **Keys are off everywhere** (storage shared keys, Cosmos local auth, App Insights local auth). New code must use `DefaultAzureCredential` with `AZURE_CLIENT_ID` (the user-assigned identity).
- **The deploy identity can only grant five specific roles** (ABAC condition set in `bootstrap.sh`). Adding a new role assignment in Bicep means adding its role ID to `ALLOWED_ROLES` there and re-running the script.
- **A brand-new subscription has few resource providers registered**; `bootstrap.sh` registers them. The pipeline identity can't, since it only has resource-group rights.
- **Key Vault has purge protection**, so a deleted vault's name stays reserved for 90 days.
- **GitHub Free on a private repo has no environment variables, environment secrets or required reviewers.** So deploy settings are repo variables with `_PROD` / `_TEST` suffixes, both Azure identities trust only `main`, and the push target comes from repo variable `AUTO_DEPLOY_ENV` (unset = prod). Once test exists, prod is protected by being manual-only (`workflow_dispatch` with `environment: prod`). Workflows read settings with `vars[format('AZURE_CLIENT_ID_{0}', env.TARGET)]`.
- **GitHub's OIDC subject uses immutable IDs:** `repo:aadekojo@118394138/xplorio@1437499581:ref:refs/heads/main`, not `repo:aadekojo/xplorio:...`. A federated credential with the name-only form fails with AADSTS700213. `bootstrap.sh` uses the ID form (`GITHUB_OIDC_REPO`); the error message always shows the exact subject GitHub sent.
- **Cosmos DB lives in Canada East, not Canada Central.** On 2026-10-28 Canada Central refused new Cosmos accounts ("high demand", ServiceUnavailable). `cosmosLocation = 'canadaeast'` in both param files; everything else stays in Canada Central. A region access request (aka.ms/cosmosdbquota) could move it back later, but moving an existing account means recreating it.
- **Test never gets the Cosmos free tier** (one per subscription, prod has it); test runs serverless. Test always uses the mock flight provider.
- **Working in the owner's folder from Claude:** file deletion is not permitted there. Don't delete files; tell the owner what to remove. The owner runs git commits and pushes.

## Build order

1. Repo and pipeline (done)
2. Infrastructure (code written, deploy pending): Bicep for Static Web App, Function App, Cosmos, Key Vault, App Insights per environment (prod + test); GitHub OIDC to Azure
3. Core and providers: AeroDataBox adapter behind `FlightDataProvider`
4. Auth: External ID tenant, app registration, invite allow-list, token validation middleware, sign-in screen
5. Add and view a flight: Expo app with Tamagui, status card, flight list; first deploy to xp.adekojo.cloud
6. Polling and cache: timer function, shared `flightCache`, budget guard, rate limits
7. Map and history: MapLibre route map, past flights, stats
8. Alerts: Web Push subscription, change detection, notifications
9. Privacy features: delete account, export data, privacy page; then invite friends
10. iOS (back burner): Apple Developer account, EAS build, TestFlight, APNs, Live Activities

## Status

_Last updated: 2026-10-28_

- **Done:** Step 1. Monorepo scaffolded and verified, pushed to `github.com/aadekojo/xplorio` (private).
- **Also done early:** `packages/core` schemas and rules (alert detection, polling schedule) with tests; `packages/providers` interface and mock provider; `/api/health` endpoint; typed api-client stub.
- **Step 2 code written, not yet deployed:** Bicep (compiles, lints clean for both environments), `bootstrap.sh` (shellcheck clean), `infra.yml`, `deploy-api.yml`, `deploy-web.yml`, placeholder page. Two environments (prod, test) in one subscription, two resource groups.
- **Next (owner):** create the `xplorio` subscription, run `bootstrap.sh` with `ENVIRONMENT=prod`, then Infrastructure > Deploy web > Cloudflare CNAME `xp` > `bindCustomDomain = true` > Deploy API. Steps in `infra/README.md`. Test is set up later ("Turning on test later" in `infra/README.md`).
- **Then:** Step 3, AeroDataBox adapter.
- **Open items:** Remove the leftover `../xplorio-scaffold.tgz` archive in `01-projects`.
