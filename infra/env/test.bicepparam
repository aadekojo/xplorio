using '../main.bicep'

param environmentName = 'test'
param customDomain = 'xp-test.adekojo.cloud'

// Flip to true once the Cloudflare CNAME for xp-test points at this environment's Static Web App.
param bindCustomDomain = false

// The free tier is one per subscription and prod has it, so test runs serverless (cents a month).
param cosmosEnableFreeTier = false

// Test stays on the mock provider so it never spends real API units.
param flightProvider = 'mock'
