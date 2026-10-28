# infra

Everything Xplorio runs on, as Bicep, in a **dedicated Azure subscription** with one resource group (`rg-xplorio`, Canada Central). GitHub Actions deploys it with OIDC, so no Azure secrets are stored in GitHub.

## What gets created

| Resource                                | Plan / setting                                                     | Why                                                                                |
| --------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| Managed identity `id-xplorio-api`       | User-assigned                                                      | The API's only identity: storage, telemetry, Cosmos data, Key Vault secrets        |
| Function App + plan                     | Flex Consumption, Node 22, 2 GB instances, max 40 instances        | `apps/api`; HTTPS only, FTP and publishing passwords off, CORS to your domain only |
| Storage account                         | Standard LRS, shared keys **off**                                  | Functions host storage and the deployment package, identity access only            |
| Cosmos DB for NoSQL                     | **Free tier**, 1000 RU/s shared, keys **off**                      | Five containers from the data model; the API identity has the data role            |
| Key Vault                               | RBAC, soft delete 90 days, purge protection                        | Holds `aerodatabox-api-key`; reads are audit-logged                                |
| Log Analytics + App Insights            | 30-day retention, 0.15 GB/day cap, Entra-only ingestion            | Stays inside the free 5 GB/month                                                   |
| Static Web App                          | Free, metadata in Central US (not offered in Canada), files global | Web build at `xp.adekojo.cloud`                                                    |
| Budget `xplorio-monthly` (subscription) | Alerts at 50% and 100% actual, 100% forecast                       | Created once by the bootstrap script                                               |

All names come from `appName` (`xplorio`) plus a short hash for globally unique ones.

## Files

```
main.bicep             Resource group deployment (run by .github/workflows/infra.yml)
main.bicepparam        Settings you edit: custom domain binding, Cosmos free tier, flight provider
modules/               monitoring, functions, cosmos, keyvault, staticwebapp
bootstrap/bootstrap.sh One-time setup you run yourself
bootstrap/budget.bicep Subscription budget, deployed by the bootstrap script
```

## First-time setup

1. **Create the subscription.** Azure portal > Subscriptions > Add, name it `xplorio`, and copy its subscription ID.
2. **Run the bootstrap** from the repo root, signed in as an Owner of the new subscription:
   ```sh
   az login
   SUBSCRIPTION_ID=<new subscription id> ALERT_EMAIL=<your email> ./infra/bootstrap/bootstrap.sh
   ```
   With the `gh` CLI signed in, it also creates the GitHub `production` environment and four repo variables. Otherwise it prints them for you to add by hand.
3. **Deploy the infrastructure.** GitHub > Actions > Infrastructure > Run workflow. Its summary shows the Static Web App hostname.
4. **Publish the placeholder page.** Actions > Deploy web > Run workflow.
5. **Point the domain.** In Cloudflare, add a CNAME `xp` → the Static Web App hostname, **DNS only (grey cloud)**.
6. **Bind the domain.** Set `bindCustomDomain = true` in `main.bicepparam` and push. Once Azure shows the domain as ready and https://xp.adekojo.cloud loads, you can turn on the Cloudflare proxy.
7. **Deploy the API.** Actions > Deploy API > Run workflow; it finishes by calling `/api/health`.

## The deploy identity's permissions

The GitHub identity (`github-aadekojo-xplorio-deploy`) can only act on `rg-xplorio`:

- **Contributor** on the resource group.
- **Role Based Access Control Administrator** on the resource group, with a condition that it may only grant five roles: Storage Blob Data Owner, Storage Queue Data Contributor, Storage Table Data Contributor, Monitoring Metrics Publisher and Key Vault Secrets User. It cannot make anyone, including itself, an Owner.
- Tokens are issued only to workflow jobs running in the GitHub `production` environment.

## Adding the flight data key (build step 3)

```sh
az keyvault secret set --vault-name <keyVaultName from the deploy summary> \
  --name aerodatabox-api-key --value "<key from API.Market>"
```

Then set `flightProvider = 'aerodatabox'` in `main.bicepparam` and push.
