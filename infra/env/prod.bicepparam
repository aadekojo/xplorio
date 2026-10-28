using '../main.bicep'

param environmentName = 'prod'
param customDomain = 'xp.adekojo.cloud'

// Flip to true once the Cloudflare CNAME for xp points at this environment's Static Web App.
param bindCustomDomain = false

// Prod gets the subscription's one free-tier Cosmos account.
param cosmosEnableFreeTier = true

// Canada Central refused new Cosmos accounts on capacity (Oct 2026); Canada East keeps data in Canada.
param cosmosLocation = 'canadaeast'

// Switch to 'aerodatabox' after the API key is stored in prod's Key Vault (build step 3).
param flightProvider = 'mock'
