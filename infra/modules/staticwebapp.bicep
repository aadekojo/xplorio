// Static Web App (Free) for the web build. Holds only static files, no user data.
// Static Web Apps isn't offered in Canadian regions; the resource's region only sets where its
// metadata lives, and the files themselves are served from a global edge network.

param location string
param name string
param tags object

@description('Custom domain, e.g. xp.adekojo.cloud. Bind it only after the CNAME exists in Cloudflare.')
param customDomain string = ''

resource site 'Microsoft.Web/staticSites@2024-04-01' = {
  name: name
  location: location
  tags: tags
  sku: {
    name: 'Free'
    tier: 'Free'
  }
  properties: {
    // Deployed from GitHub Actions with the CLI, not through the built-in GitHub integration.
    allowConfigFileUpdates: true
    stagingEnvironmentPolicy: 'Disabled'
  }
}

resource domain 'Microsoft.Web/staticSites/customDomains@2024-04-01' = if (!empty(customDomain)) {
  parent: site
  name: empty(customDomain) ? 'unused' : customDomain
  properties: {
    validationMethod: 'cname-delegation'
  }
}

output name string = site.name
output defaultHostname string = site.properties.defaultHostname
