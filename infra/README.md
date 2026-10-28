# infra

Bicep templates for every Azure resource Xplorio uses. Filled in at build step 2.

| Resource             | Plan                                                       | Notes                                                                                            |
| -------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Static Web App       | Free                                                       | Serves the web build at `xp.example.com` (Cloudflare CNAME, DNS-only until the cert is issued) |
| Function App         | Flex Consumption                                           | `apps/api`; managed identity; CORS limited to `https://xp.example.com`                         |
| Cosmos DB for NoSQL  | Free tier (`enableFreeTier: true`, can't be enabled later) | Canada Central; one database at 1000 RU/s shared                                                 |
| Key Vault            | Standard, RBAC mode                                        | Holds the AeroDataBox key; Function App identity gets `Key Vault Secrets User`                   |
| Application Insights | Workspace-based                                            | 30-day retention                                                                                 |

Deployment runs from GitHub Actions using OIDC federated credentials, so no Azure secrets are stored in GitHub.

All names derive from one `appName` parameter (default `xplorio`) so a rename touches one value.
