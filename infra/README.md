# infra

Everything Xplorio runs on, as Bicep, in a **dedicated Azure subscription** with room for **two environments**, each in its own resource group in Canada Central. **Only prod is in use for now**; test is defined in code and gets set up later with one bootstrap run. GitHub Actions deploys with OIDC, so no Azure secrets are stored in GitHub.

## Environments

|                      | prod                                                      | test                                |
| -------------------- | --------------------------------------------------------- | ----------------------------------- |
| Resource group       | `rg-xplorio-prod`                                         | `rg-xplorio-test`                   |
| URL                  | `xp.adekojo.cloud`                                        | `xp-test.adekojo.cloud`             |
| Parameters           | `env/prod.bicepparam`                                     | `env/test.bicepparam`               |
| Cosmos DB            | Free tier (one per subscription)                          | Serverless, cents a month           |
| Flight data          | Mock now, AeroDataBox from step 3                         | Always mock, never spends API units |
| Deploy identity      | `github-xplorio-prod-deploy`                              | `github-xplorio-test-deploy`        |
| How it gets deployed | **Now:** every push to `main`. **Later:** manual run only | **Later:** every push to `main`     |
| Status               | In use                                                    | Not set up yet                      |

Each deploy identity can only reach its own resource group, so a test deploy can never touch prod.

## What each environment contains

| Resource                                | Plan / setting                                                     | Why                                                                                   |
| --------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| Managed identity `id-xplorio-<env>-api` | User-assigned                                                      | The API's only identity: storage, telemetry, Cosmos data, Key Vault secrets           |
| Function App + plan                     | Flex Consumption, Node 22, 2 GB instances, max 40 instances        | `apps/api`; HTTPS only, FTP and publishing passwords off, CORS to its own domain only |
| Storage account                         | Standard LRS, shared keys **off**                                  | Functions host storage and the deployment package, identity access only               |
| Cosmos DB for NoSQL                     | Free tier (prod) or serverless (test), keys **off**                | Five containers from the data model; the API identity has the data role               |
| Key Vault                               | RBAC, soft delete 90 days, purge protection                        | Holds `aerodatabox-api-key`; reads are audit-logged                                   |
| Log Analytics + App Insights            | 30-day retention, 0.15 GB/day cap, Entra-only ingestion            | Stays inside the free 5 GB/month                                                      |
| Static Web App                          | Free, metadata in Central US (not offered in Canada), files global | The web build                                                                         |

Shared by both: one subscription budget, `xplorio-monthly`, alerting at 50% and 100% actual and 100% forecast.

Names follow `<type>-xplorio-<env>`, plus a short hash for globally unique ones.

## Files

```
main.bicep             One environment's resources (run by .github/workflows/infra.yml)
env/prod.bicepparam    Prod settings: domain, custom domain binding, Cosmos free tier, flight provider
env/test.bicepparam    Test settings
modules/               monitoring, functions, cosmos, keyvault, staticwebapp
bootstrap/bootstrap.sh One-time setup per environment, run by you
bootstrap/budget.bicep Subscription budget, deployed by the bootstrap script
```

## First-time setup

1. **Create the subscription.** Azure portal > Subscriptions > Add, name it `xplorio`, and copy its subscription ID.
2. **Bootstrap prod** from the repo root, signed in as an Owner of the subscription:
   ```sh
   az login
   export SUBSCRIPTION_ID=<subscription id> ALERT_EMAIL=<your email>
   ENVIRONMENT=prod ./infra/bootstrap/bootstrap.sh
   ```
   With the `gh` CLI signed in, it sets the repo variables (`AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`, `AZURE_CLIENT_ID_PROD`, `AZURE_RESOURCE_GROUP_PROD`). Otherwise it prints them for you to add.
3. **Deploy infrastructure.** GitHub > Actions > Infrastructure > Run workflow (prod is the default). The run summary shows the Static Web App hostname.
4. **Publish the placeholder page.** Actions > Deploy web > Run workflow.
5. **Point the domain.** In Cloudflare, add a CNAME `xp` pointing at the Static Web App hostname, **DNS only (grey cloud)**.
6. **Bind the domain.** Set `bindCustomDomain = true` in `env/prod.bicepparam` and push; the push deploys it. Once https://xp.adekojo.cloud loads you can turn on the Cloudflare proxy.
7. **Deploy the API.** Actions > Deploy API > Run workflow; it finishes by calling `/api/health`.

## Day to day

**Now:** push to `main` and infrastructure, API and web changes deploy to **prod**. You can also run any deploy workflow by hand.

The auto-deploy target is the `AUTO_DEPLOY_ENV` repo variable; when it isn't set, pushes go to prod.

## Turning on test later

1. Bootstrap test: `ENVIRONMENT=test ./infra/bootstrap/bootstrap.sh` (same `SUBSCRIPTION_ID` and `ALERT_EMAIL`).
2. Run Infrastructure, then Deploy web, choosing `test`. Add a Cloudflare CNAME `xp-test` for the new hostname, set `bindCustomDomain = true` in `env/test.bicepparam`, and run Infrastructure for `test` again. Then run Deploy API for `test`.
3. Switch pushes to test: `gh variable set AUTO_DEPLOY_ENV --body test` (or add it under repo Settings > Secrets and variables > Actions > Variables).

From then on, pushes land in test at `xp-test.adekojo.cloud`, and prod only changes when you run a workflow by hand and pick `prod`.

## Deploy identity permissions

Each environment's identity:

- Is trusted only for workflow runs on `main` (OIDC subject `repo:aadekojo/xplorio:ref:refs/heads/main`). Pull requests and other branches can't get a token.
- Has **Contributor** on its own resource group only.
- Has **Role Based Access Control Administrator** on its own resource group, limited by a condition to granting five roles: Storage Blob Data Owner, Storage Queue Data Contributor, Storage Table Data Contributor, Monitoring Metrics Publisher and Key Vault Secrets User. It can never grant Owner.

GitHub Free doesn't offer environment variables or required reviewers on private repos. That's why, once test is on, prod is protected by being manual-only rather than by an approval gate. On GitHub Pro you could move to environment-scoped OIDC subjects and add a required reviewer for prod.

## Adding the flight data key (build step 3, prod only)

```sh
az keyvault secret set --vault-name <prod keyVaultName from the deploy summary> \
  --name aerodatabox-api-key --value "<key from API.Market>"
```

Then set `flightProvider = 'aerodatabox'` in `env/prod.bicepparam` and run Infrastructure with `prod`.
