// Azure Functions on the Flex Consumption plan, running as a user-assigned managed identity.
// Storage uses identity-based access only (shared keys disabled); no connection strings anywhere.

param location string
param tags object
param functionAppName string
param planName string
param storageAccountName string

param identityId string
param identityPrincipalId string
param identityClientId string

param appInsightsName string
param appInsightsConnectionString string

param cosmosEndpoint string
param cosmosDatabaseName string
param keyVaultName string
param keyVaultUri string

@description('Origins allowed to call the API from a browser.')
param allowedOrigins array

@description('mock while developing; aerodatabox once the key is in Key Vault.')
@allowed(['mock', 'aerodatabox'])
param flightProvider string = 'mock'

var deploymentContainerName = 'app-package'

// Built-in role definition IDs.
var roles = {
  storageBlobDataOwner: 'b7e6dc6d-f1e8-4753-8033-0f276bb0955b'
  storageQueueDataContributor: '974c5e8b-45b9-4653-ba55-5f855dd0fb88'
  storageTableDataContributor: '0a9a7e1f-b9d0-4cc4-a60d-0319b160aaa3'
  monitoringMetricsPublisher: '3913510d-42f4-4e42-8a64-420c390055eb'
}

resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageAccountName
  location: location
  tags: tags
  kind: 'StorageV2'
  sku: {
    name: 'Standard_LRS'
  }
  properties: {
    accessTier: 'Hot'
    allowBlobPublicAccess: false
    allowSharedKeyAccess: false
    defaultToOAuthAuthentication: true
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
    publicNetworkAccess: 'Enabled'
    networkAcls: {
      bypass: 'AzureServices'
      defaultAction: 'Allow'
    }
  }

  resource blobServices 'blobServices' = {
    name: 'default'
    resource deploymentContainer 'containers' = {
      name: deploymentContainerName
      properties: {
        publicAccess: 'None'
      }
    }
  }
}

resource storageRoles 'Microsoft.Authorization/roleAssignments@2022-04-01' = [
  for roleId in [roles.storageBlobDataOwner, roles.storageQueueDataContributor, roles.storageTableDataContributor]: {
    name: guid(storage.id, identityPrincipalId, roleId)
    scope: storage
    properties: {
      roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleId)
      principalId: identityPrincipalId
      principalType: 'ServicePrincipal'
    }
  }
]

resource appInsights 'Microsoft.Insights/components@2020-02-02' existing = {
  name: appInsightsName
}

resource telemetryRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(appInsights.id, identityPrincipalId, roles.monitoringMetricsPublisher)
  scope: appInsights
  properties: {
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions',
      roles.monitoringMetricsPublisher
    )
    principalId: identityPrincipalId
    principalType: 'ServicePrincipal'
  }
}

resource plan 'Microsoft.Web/serverfarms@2024-04-01' = {
  name: planName
  location: location
  tags: tags
  kind: 'functionapp'
  sku: {
    tier: 'FlexConsumption'
    name: 'FC1'
  }
  properties: {
    reserved: true
  }
}

resource functionApp 'Microsoft.Web/sites@2024-04-01' = {
  name: functionAppName
  location: location
  tags: tags
  kind: 'functionapp,linux'
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${identityId}': {}
    }
  }
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    keyVaultReferenceIdentity: identityId
    siteConfig: {
      minTlsVersion: '1.2'
      scmMinTlsVersion: '1.2'
      ftpsState: 'Disabled'
      http20Enabled: true
      cors: {
        allowedOrigins: allowedOrigins
        supportCredentials: false
      }
    }
    functionAppConfig: {
      deployment: {
        storage: {
          type: 'blobContainer'
          value: '${storage.properties.primaryEndpoints.blob}${deploymentContainerName}'
          authentication: {
            type: 'UserAssignedIdentity'
            userAssignedIdentityResourceId: identityId
          }
        }
      }
      scaleAndConcurrency: {
        // Lowest allowed ceiling; a personal app never needs more, and it caps runaway cost.
        maximumInstanceCount: 40
        instanceMemoryMB: 2048
      }
      runtime: {
        name: 'node'
        version: '22'
      }
    }
  }
  dependsOn: [
    storageRoles
  ]

  resource settings 'config' = {
    name: 'appsettings'
    properties: {
      // Host storage, identity-based.
      AzureWebJobsStorage__accountName: storage.name
      AzureWebJobsStorage__credential: 'managedidentity'
      AzureWebJobsStorage__clientId: identityClientId

      // Telemetry, sent with an Entra token because local auth is off on App Insights.
      APPLICATIONINSIGHTS_CONNECTION_STRING: appInsightsConnectionString
      APPLICATIONINSIGHTS_AUTHENTICATION_STRING: 'ClientId=${identityClientId};Authorization=AAD'

      // Lets DefaultAzureCredential in the app pick the right identity for Cosmos and Key Vault.
      AZURE_CLIENT_ID: identityClientId

      COSMOS_ENDPOINT: cosmosEndpoint
      COSMOS_DATABASE: cosmosDatabaseName
      KEY_VAULT_URI: keyVaultUri
      FLIGHT_PROVIDER: flightProvider
      ALLOWED_ORIGINS: join(allowedOrigins, ',')

      // Resolved from Key Vault at runtime; shows as unresolved until the secret is created.
      AERODATABOX_API_KEY: '@Microsoft.KeyVault(VaultName=${keyVaultName};SecretName=aerodatabox-api-key)'
    }
  }
}

// No publishing passwords: deploys authenticate with Entra (OIDC from GitHub).
resource ftpCreds 'Microsoft.Web/sites/basicPublishingCredentialsPolicies@2024-04-01' = {
  parent: functionApp
  name: 'ftp'
  properties: {
    allow: false
  }
}

resource scmCreds 'Microsoft.Web/sites/basicPublishingCredentialsPolicies@2024-04-01' = {
  parent: functionApp
  name: 'scm'
  properties: {
    allow: false
  }
}

output name string = functionApp.name
output defaultHostname string = functionApp.properties.defaultHostName
