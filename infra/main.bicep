// Xplorio: every Azure resource one environment needs, deployed into that environment's
// resource group (rg-xplorio-prod or rg-xplorio-test) inside the dedicated Xplorio subscription.
// Deployed by .github/workflows/infra.yml with infra/env/<environment>.bicepparam.

targetScope = 'resourceGroup'

@description('Short app name used in every resource name. Changing it renames everything.')
@minLength(3)
@maxLength(9)
param appName string = 'xplorio'

@description('Which environment this deployment is. Part of every resource name.')
@allowed(['prod', 'test'])
param environmentName string

@description('Region for data and compute. Keeps user data in Canada.')
param location string = resourceGroup().location

@description('Region for Cosmos DB. Separate because Canada Central sometimes refuses new Cosmos accounts on capacity; Canada East keeps data in Canada.')
param cosmosLocation string = location

@description('Static Web Apps is not offered in Canada; this region only holds its metadata.')
@allowed(['centralus', 'eastus2', 'westus2', 'westeurope', 'eastasia'])
param staticWebAppLocation string = 'centralus'

@description('Public hostname of this environment, e.g. xp.example.com or xp-test.example.com.')
param customDomain string

@description('Bind the custom domain. Set true only after the Cloudflare CNAME points at the Static Web App.')
param bindCustomDomain bool = false

@description('Use the Cosmos DB free tier (one per subscription). False switches to serverless.')
param cosmosEnableFreeTier bool = true

@allowed(['mock', 'aerodatabox'])
param flightProvider string = 'mock'

var suffix = take(uniqueString(resourceGroup().id), 6)
var tags = {
  app: appName
  environment: environmentName
  managedBy: 'bicep'
}

// <type>-<app>-<env>[-<hash>]; the hash keeps globally unique names unique. Key Vault names max out at 24.
var base = '${appName}-${environmentName}'
var names = {
  identity: 'id-${base}-api'
  logAnalytics: 'log-${base}'
  appInsights: 'appi-${base}'
  cosmos: 'cosmos-${base}-${suffix}'
  keyVault: 'kv-${base}-${suffix}'
  storage: 'st${appName}${environmentName}${suffix}'
  plan: 'plan-${base}'
  functionApp: 'func-${base}-${suffix}'
  staticWebApp: 'swa-${base}'
}

// The API's single identity: storage, telemetry, Cosmos data and Key Vault secrets.
resource apiIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: names.identity
  location: location
  tags: tags
}

module monitoring 'modules/monitoring.bicep' = {
  name: 'monitoring'
  params: {
    location: location
    logAnalyticsName: names.logAnalytics
    appInsightsName: names.appInsights
    tags: tags
  }
}

module staticWebApp 'modules/staticwebapp.bicep' = {
  name: 'staticWebApp'
  params: {
    location: staticWebAppLocation
    name: names.staticWebApp
    tags: tags
    customDomain: bindCustomDomain ? customDomain : ''
  }
}

module cosmos 'modules/cosmos.bicep' = {
  name: 'cosmos'
  params: {
    location: cosmosLocation
    accountName: names.cosmos
    databaseName: appName
    tags: tags
    enableFreeTier: cosmosEnableFreeTier
    apiPrincipalId: apiIdentity.properties.principalId
    logAnalyticsId: monitoring.outputs.logAnalyticsId
  }
}

module keyVault 'modules/keyvault.bicep' = {
  name: 'keyVault'
  params: {
    location: location
    name: names.keyVault
    tags: tags
    apiPrincipalId: apiIdentity.properties.principalId
    logAnalyticsId: monitoring.outputs.logAnalyticsId
  }
}

module functions 'modules/functions.bicep' = {
  name: 'functions'
  params: {
    location: location
    tags: tags
    functionAppName: names.functionApp
    planName: names.plan
    storageAccountName: names.storage
    identityId: apiIdentity.id
    identityPrincipalId: apiIdentity.properties.principalId
    identityClientId: apiIdentity.properties.clientId
    appInsightsName: monitoring.outputs.appInsightsName
    appInsightsConnectionString: monitoring.outputs.appInsightsConnectionString
    cosmosEndpoint: cosmos.outputs.endpoint
    cosmosDatabaseName: cosmos.outputs.databaseName
    keyVaultName: keyVault.outputs.name
    keyVaultUri: keyVault.outputs.uri
    flightProvider: flightProvider
    allowedOrigins: [
      'https://${customDomain}'
      'https://${staticWebApp.outputs.defaultHostname}'
    ]
  }
}

output environmentName string = environmentName
output functionAppName string = functions.outputs.name
output apiHostname string = functions.outputs.defaultHostname
output staticWebAppName string = staticWebApp.outputs.name
output staticWebAppHostname string = staticWebApp.outputs.defaultHostname
output keyVaultName string = keyVault.outputs.name
output cosmosAccountName string = cosmos.outputs.accountName
