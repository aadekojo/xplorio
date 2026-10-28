// Log Analytics workspace + workspace-based Application Insights.
// A daily ingestion cap keeps usage inside the free monthly allowance.

param location string
param logAnalyticsName string
param appInsightsName string
param tags object

@description('Daily ingestion cap in GB. 0.15 GB/day stays under the 5 GB/month free allowance.')
param dailyQuotaGb string = '0.15'

resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: logAnalyticsName
  location: location
  tags: tags
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
    workspaceCapping: {
      dailyQuotaGb: json(dailyQuotaGb)
    }
  }
}

resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: appInsightsName
  location: location
  tags: tags
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalytics.id
    // Telemetry must be sent with a Microsoft Entra token, not just the connection string.
    DisableLocalAuth: true
    IngestionMode: 'LogAnalytics'
  }
}

output logAnalyticsId string = logAnalytics.id
output appInsightsId string = appInsights.id
output appInsightsName string = appInsights.name
output appInsightsConnectionString string = appInsights.properties.ConnectionString
