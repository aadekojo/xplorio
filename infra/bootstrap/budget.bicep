// Monthly cost alert for the whole Xplorio subscription. Deployed once by bootstrap.sh
// (with your own sign-in), not by GitHub, so the pipeline identity needs no subscription-wide rights.

targetScope = 'subscription'

@description('Monthly budget in the billing currency.')
param amount int = 10

@description('Who gets the alert emails.')
param contactEmail string

@description('First day of a month, on or after the current month. Fixed so redeploys never change it.')
param startDate string

resource budget 'Microsoft.Consumption/budgets@2023-11-01' = {
  name: 'xplorio-monthly'
  properties: {
    category: 'Cost'
    amount: amount
    timeGrain: 'Monthly'
    timePeriod: {
      startDate: startDate
    }
    notifications: {
      actualOver50: {
        enabled: true
        operator: 'GreaterThan'
        threshold: 50
        thresholdType: 'Actual'
        contactEmails: [contactEmail]
      }
      actualOver100: {
        enabled: true
        operator: 'GreaterThan'
        threshold: 100
        thresholdType: 'Actual'
        contactEmails: [contactEmail]
      }
      forecastOver100: {
        enabled: true
        operator: 'GreaterThan'
        threshold: 100
        thresholdType: 'Forecasted'
        contactEmails: [contactEmail]
      }
    }
  }
}
