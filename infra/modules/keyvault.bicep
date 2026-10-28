// Key Vault in RBAC mode. Holds the flight data provider key (and later the Web Push VAPID key).
// The secret itself is set by hand with the CLI, never through templates or the repo.

param location string
param name string
param tags object
param logAnalyticsId string

@description('Principal ID of the API managed identity, granted read access to secrets.')
param apiPrincipalId string

// Built-in "Key Vault Secrets User" role.
var secretsUserRoleId = '4633458b-17de-408a-b874-0445c86b69e6'

resource vault 'Microsoft.KeyVault/vaults@2024-11-01' = {
  name: name
  location: location
  tags: tags
  properties: {
    tenantId: subscription().tenantId
    sku: {
      family: 'A'
      name: 'standard'
    }
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 90
    enablePurgeProtection: true
    publicNetworkAccess: 'Enabled'
    networkAcls: {
      bypass: 'AzureServices'
      defaultAction: 'Allow'
    }
  }
}

resource apiSecretsUser 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(vault.id, apiPrincipalId, secretsUserRoleId)
  scope: vault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', secretsUserRoleId)
    principalId: apiPrincipalId
    principalType: 'ServicePrincipal'
  }
}

// Audit log of every secret read, kept in Log Analytics.
resource diagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'to-log-analytics'
  scope: vault
  properties: {
    workspaceId: logAnalyticsId
    logs: [
      { category: 'AuditEvent', enabled: true }
    ]
  }
}

output name string = vault.name
output uri string = vault.properties.vaultUri
