using 'main.bicep'

param appName = 'xplorio'
param staticWebAppLocation = 'centralus'
param customDomain = 'xp.example.com'

// Flip to true once the Cloudflare CNAME for xp points at the Static Web App's default hostname.
param bindCustomDomain = false

// New dedicated subscription, so its one free-tier Cosmos account is available.
param cosmosEnableFreeTier = true

// Switch to 'aerodatabox' after the API key is stored in Key Vault (build step 3).
param flightProvider = 'mock'
