using '../main.bicep'

param environmentName = 'prod'
param customDomain = 'xp.example.com'

// Flip to true once the Cloudflare CNAME for xp points at this environment's Static Web App.
param bindCustomDomain = false

// Prod gets the subscription's one free-tier Cosmos account.
param cosmosEnableFreeTier = true

// Switch to 'aerodatabox' after the API key is stored in prod's Key Vault (build step 3).
param flightProvider = 'mock'
