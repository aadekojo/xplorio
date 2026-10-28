#!/usr/bin/env bash
# One-time setup for the dedicated Xplorio subscription. Run it yourself, signed in with `az login`
# as an Owner of the subscription. Safe to re-run: every step checks before it creates.
#
# What it does:
#   1. Registers the resource providers a brand-new subscription is missing
#   2. Creates the resource group
#   3. Creates the GitHub deploy identity (app registration + OIDC federated credential, no secret)
#   4. Grants that identity rights on the resource group only, with a limit on which roles it can hand out
#   5. Lets you (the signed-in user) manage Key Vault secrets in that resource group
#   6. Creates a monthly budget alert on the subscription
#   7. Creates the GitHub "production" environment and repo variables (if the gh CLI is installed)
#
# Usage:
#   SUBSCRIPTION_ID=<id> ALERT_EMAIL=<you@example.com> ./infra/bootstrap/bootstrap.sh

set -euo pipefail

: "${SUBSCRIPTION_ID:?Set SUBSCRIPTION_ID to the new Xplorio subscription ID}"
: "${ALERT_EMAIL:?Set ALERT_EMAIL to the address that should get budget alerts}"
GITHUB_REPO="${GITHUB_REPO:-aadekojo/xplorio}"
LOCATION="${LOCATION:-canadacentral}"
RESOURCE_GROUP="${RESOURCE_GROUP:-rg-xplorio}"
BUDGET_AMOUNT="${BUDGET_AMOUNT:-10}"
APP_REG_NAME="github-${GITHUB_REPO//\//-}-deploy"
GH_ENVIRONMENT="production"

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
step() { printf '\n==> %s\n' "$*"; }

step "Selecting subscription $SUBSCRIPTION_ID"
az account set --subscription "$SUBSCRIPTION_ID"
TENANT_ID="$(az account show --query tenantId -o tsv)"
az account show --query "{name:name, id:id, tenant:tenantId}" -o table

step "Registering resource providers (a new subscription starts with few registered)"
for ns in Microsoft.Web Microsoft.DocumentDB Microsoft.KeyVault Microsoft.Storage \
  Microsoft.Insights Microsoft.OperationalInsights Microsoft.ManagedIdentity \
  Microsoft.Consumption Microsoft.AlertsManagement; do
  state="$(az provider show --namespace "$ns" --query registrationState -o tsv 2>/dev/null || echo NotRegistered)"
  if [[ "$state" != "Registered" ]]; then
    echo "  registering $ns"
    az provider register --namespace "$ns" --wait --output none
  else
    echo "  $ns already registered"
  fi
done

step "Checking Flex Consumption is offered in $LOCATION"
if ! az functionapp list-flexconsumption-locations --query "[].name" -o tsv | tr -d ' ' | grep -qi "^${LOCATION}$"; then
  echo "Flex Consumption isn't available in $LOCATION. Rerun with LOCATION=<a supported region>." >&2
  exit 1
fi
echo "  ok"

step "Creating resource group $RESOURCE_GROUP in $LOCATION"
az group create --name "$RESOURCE_GROUP" --location "$LOCATION" \
  --tags app=xplorio managedBy=bicep --output none
RG_ID="$(az group show --name "$RESOURCE_GROUP" --query id -o tsv)"

step "Creating the GitHub deploy identity ($APP_REG_NAME)"
CLIENT_ID="$(az ad app list --display-name "$APP_REG_NAME" --query "[0].appId" -o tsv)"
if [[ -z "$CLIENT_ID" ]]; then
  CLIENT_ID="$(az ad app create --display-name "$APP_REG_NAME" --query appId -o tsv)"
  echo "  created app registration"
else
  echo "  app registration exists"
fi
if ! az ad sp show --id "$CLIENT_ID" --output none 2>/dev/null; then
  az ad sp create --id "$CLIENT_ID" --output none
  echo "  created service principal"
fi
SP_OBJECT_ID="$(az ad sp show --id "$CLIENT_ID" --query id -o tsv)"

# Only workflow jobs that run in the GitHub "production" environment can get a token.
SUBJECT="repo:${GITHUB_REPO}:environment:${GH_ENVIRONMENT}"
if ! az ad app federated-credential list --id "$CLIENT_ID" --query "[?subject=='$SUBJECT']" -o tsv | grep -q .; then
  az ad app federated-credential create --id "$CLIENT_ID" --parameters "{
    \"name\": \"github-${GH_ENVIRONMENT}\",
    \"issuer\": \"https://token.actions.githubusercontent.com\",
    \"subject\": \"${SUBJECT}\",
    \"audiences\": [\"api://AzureADTokenExchange\"],
    \"description\": \"GitHub Actions deploys from ${GITHUB_REPO} (${GH_ENVIRONMENT} environment)\"
  }" --output none
  echo "  added federated credential for $SUBJECT"
else
  echo "  federated credential exists"
fi

assign() { # principalId role scope [condition]
  local principal="$1" role="$2" scope="$3" condition="${4:-}"
  if az role assignment list --assignee "$principal" --role "$role" --scope "$scope" --query "[0].id" -o tsv | grep -q .; then
    echo "  '$role' already assigned"
    return
  fi
  if [[ -n "$condition" ]]; then
    az role assignment create --assignee-object-id "$principal" --assignee-principal-type ServicePrincipal \
      --role "$role" --scope "$scope" --condition "$condition" --condition-version "2.0" --output none
  else
    az role assignment create --assignee-object-id "$principal" --assignee-principal-type ServicePrincipal \
      --role "$role" --scope "$scope" --output none
  fi
  echo "  assigned '$role'"
}

step "Granting the deploy identity rights on $RESOURCE_GROUP only"
assign "$SP_OBJECT_ID" "Contributor" "$RG_ID"

# The templates create role assignments, so the pipeline needs to grant roles, but only these five:
# Storage Blob Data Owner, Storage Queue Data Contributor, Storage Table Data Contributor,
# Monitoring Metrics Publisher, Key Vault Secrets User. It can never grant Owner or itself more.
ALLOWED_ROLES="b7e6dc6d-f1e8-4753-8033-0f276bb0955b, 974c5e8b-45b9-4653-ba55-5f855dd0fb88, 0a9a7e1f-b9d0-4cc4-a60d-0319b160aaa3, 3913510d-42f4-4e42-8a64-420c390055eb, 4633458b-17de-408a-b874-0445c86b69e6"
CONDITION="((!(ActionMatches{'Microsoft.Authorization/roleAssignments/write'})) OR (@Request[Microsoft.Authorization/roleAssignments:RoleDefinitionId] ForAnyOfAnyValues:GuidEquals {${ALLOWED_ROLES}})) AND ((!(ActionMatches{'Microsoft.Authorization/roleAssignments/delete'})) OR (@Resource[Microsoft.Authorization/roleAssignments:RoleDefinitionId] ForAnyOfAnyValues:GuidEquals {${ALLOWED_ROLES}}))"
assign "$SP_OBJECT_ID" "Role Based Access Control Administrator" "$RG_ID" "$CONDITION"

step "Letting you manage Key Vault secrets in $RESOURCE_GROUP"
ME="$(az ad signed-in-user show --query id -o tsv)"
if az role assignment list --assignee "$ME" --role "Key Vault Secrets Officer" --scope "$RG_ID" --query "[0].id" -o tsv | grep -q .; then
  echo "  already assigned"
else
  az role assignment create --assignee-object-id "$ME" --assignee-principal-type User \
    --role "Key Vault Secrets Officer" --scope "$RG_ID" --output none
  echo "  assigned 'Key Vault Secrets Officer' to you"
fi

step "Creating a ${BUDGET_AMOUNT}/month budget alert on the subscription"
if az consumption budget show --budget-name xplorio-monthly --output none 2>/dev/null; then
  echo "  budget exists"
else
  # First day of next month; macOS and GNU date spell this differently.
  START_DATE="$(date -v+1m +%Y-%m-01 2>/dev/null || date -d "$(date +%Y-%m-01) +1 month" +%Y-%m-01)"
  az deployment sub create --name xplorio-budget --location "$LOCATION" \
    --template-file "$here/budget.bicep" \
    --parameters amount="$BUDGET_AMOUNT" contactEmail="$ALERT_EMAIL" startDate="$START_DATE" \
    --output none
  echo "  budget starts $START_DATE"
fi

step "Configuring GitHub ($GITHUB_REPO)"
if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
  gh api --method PUT "repos/${GITHUB_REPO}/environments/${GH_ENVIRONMENT}" --silent
  gh variable set AZURE_CLIENT_ID --repo "$GITHUB_REPO" --body "$CLIENT_ID"
  gh variable set AZURE_TENANT_ID --repo "$GITHUB_REPO" --body "$TENANT_ID"
  gh variable set AZURE_SUBSCRIPTION_ID --repo "$GITHUB_REPO" --body "$SUBSCRIPTION_ID"
  gh variable set AZURE_RESOURCE_GROUP --repo "$GITHUB_REPO" --body "$RESOURCE_GROUP"
  echo "  environment '$GH_ENVIRONMENT' and four repo variables set"
else
  cat <<EOF
  gh CLI not found or not signed in. In GitHub, open the repo's Settings and:
    1. Environments > New environment > "${GH_ENVIRONMENT}"
    2. Secrets and variables > Actions > Variables > add:
         AZURE_CLIENT_ID        = ${CLIENT_ID}
         AZURE_TENANT_ID        = ${TENANT_ID}
         AZURE_SUBSCRIPTION_ID  = ${SUBSCRIPTION_ID}
         AZURE_RESOURCE_GROUP   = ${RESOURCE_GROUP}
EOF
fi

step "Done"
cat <<EOF
These IDs are identifiers, not secrets; nothing secret was created.
Next: run the "Infrastructure" workflow in GitHub Actions (or push a change under infra/).
EOF
