// Cosmos DB for NoSQL: one database, five containers, Entra-only access.
//
// enableFreeTier = true  -> provisioned 1000 RU/s shared, covered by the free tier (one per subscription).
// enableFreeTier = false -> serverless instead, so a missing free tier never means a ~$58/month bill.

param location string
param accountName string
param databaseName string
param tags object
param enableFreeTier bool

@description('Principal ID of the API managed identity, granted data read/write.')
param apiPrincipalId string

param logAnalyticsId string

// Partition keys follow the data model in the design doc: every user-owned container is partitioned by userId.
var containers = [
  { name: 'users', partitionKey: '/id', defaultTtl: null }
  { name: 'trackedFlights', partitionKey: '/userId', defaultTtl: null }
  // TTL is enabled (-1 = no default); the poller sets ttl on each entry to expire 30 days after landing.
  { name: 'flightCache', partitionKey: '/flightKey', defaultTtl: -1 }
  { name: 'pushSubscriptions', partitionKey: '/userId', defaultTtl: null }
  { name: 'usage', partitionKey: '/month', defaultTtl: null }
]

// Built-in "Cosmos DB Built-in Data Contributor" data-plane role.
var dataContributorRoleId = '00000000-0000-0000-0000-000000000002'

resource account 'Microsoft.DocumentDB/databaseAccounts@2024-11-15' = {
  name: accountName
  location: location
  tags: tags
  kind: 'GlobalDocumentDB'
  properties: {
    databaseAccountOfferType: 'Standard'
    enableFreeTier: enableFreeTier
    capabilities: enableFreeTier ? [] : [{ name: 'EnableServerless' }]
    locations: [
      {
        locationName: location
        failoverPriority: 0
        isZoneRedundant: false
      }
    ]
    consistencyPolicy: {
      defaultConsistencyLevel: 'Session'
    }
    // Keys are disabled: only Entra identities with a data-plane role can read or write.
    disableLocalAuth: true
    disableKeyBasedMetadataWriteAccess: true
    minimalTlsVersion: 'Tls12'
    publicNetworkAccess: 'Enabled'
  }
}

resource database 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2024-11-15' = {
  parent: account
  name: databaseName
  properties: {
    resource: {
      id: databaseName
    }
    options: enableFreeTier ? { throughput: 1000 } : {}
  }
}

resource sqlContainers 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-11-15' = [
  for c in containers: {
    parent: database
    name: c.name
    properties: {
      resource: union(
        {
          id: c.name
          partitionKey: {
            paths: [c.partitionKey]
            kind: 'Hash'
          }
        },
        c.defaultTtl == null ? {} : { defaultTtl: c.defaultTtl }
      )
    }
  }
]

resource apiDataAccess 'Microsoft.DocumentDB/databaseAccounts/sqlRoleAssignments@2024-11-15' = {
  parent: account
  name: guid(account.id, apiPrincipalId, dataContributorRoleId)
  properties: {
    roleDefinitionId: '${account.id}/sqlRoleDefinitions/${dataContributorRoleId}'
    principalId: apiPrincipalId
    scope: account.id
  }
}

resource diagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'to-log-analytics'
  scope: account
  properties: {
    workspaceId: logAnalyticsId
    logs: [
      { category: 'ControlPlaneRequests', enabled: true }
    ]
  }
}

output endpoint string = account.properties.documentEndpoint
output accountName string = account.name
output databaseName string = database.name
