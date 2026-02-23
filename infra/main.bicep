targetScope = 'subscription'

@minLength(1)
@maxLength(64)
@description('Name of the environment which is used to generate a short unique hash used in all resources.')
param environmentName string

@minLength(1)
@description('Primary location for all resources')
param location string

@description('Kubernetes namespace for workloads')
param k8sNamespace string = 'aks-chaos-demo'

@description('Name of the resource group (auto-generated if empty)')
param resourceGroupName string = ''

var baseName = environmentName
var tags = { 'azd-env-name': environmentName }

// Organize resources in a resource group
resource rg 'Microsoft.Resources/resourceGroups@2021-04-01' = {
  name: !empty(resourceGroupName) ? resourceGroupName : 'rg-${environmentName}'
  location: location
  tags: tags
}

// --- Monitoring ---
module monitoring 'modules/monitoring.bicep' = {
  scope: rg
  name: 'monitoring'
  params: {
    logAnalyticsName: '${baseName}-logs'
    appInsightsName: '${baseName}-ai'
    location: location
  }
}

// --- AKS Cluster ---
module aks 'modules/aks.bicep' = {
  scope: rg
  name: 'aks'
  params: {
    clusterName: '${baseName}-aks'
    location: location
    logAnalyticsWorkspaceId: monitoring.outputs.logAnalyticsWorkspaceId
  }
}

// --- Event Hub ---
module eventhub 'modules/eventhub.bicep' = {
  scope: rg
  name: 'eventhub'
  params: {
    namespaceName: '${baseName}-ehns'
    location: location
  }
}

// --- Web PubSub ---
module webpubsub 'modules/webpubsub.bicep' = {
  scope: rg
  name: 'webpubsub'
  params: {
    webPubSubName: '${baseName}-wps'
    location: location
  }
}

// --- Container Registry ---
module acr 'modules/acr.bicep' = {
  scope: rg
  name: 'acr'
  params: {
    acrName: replace('${baseName}acr', '-', '')
    location: location
  }
}

// --- Workload Identity ---
module identity 'modules/identity.bicep' = {
  scope: rg
  name: 'identity'
  params: {
    identityName: '${baseName}-id'
    location: location
    aksOidcIssuerUrl: aks.outputs.oidcIssuerUrl
    k8sNamespace: k8sNamespace
  }
}

// --- Role Assignments ---
module roleAssignments 'modules/roleassignments.bicep' = {
  scope: rg
  name: 'roleAssignments'
  params: {
    principalId: identity.outputs.identityPrincipalId
    eventHubNamespaceId: eventhub.outputs.namespaceId
    webPubSubId: webpubsub.outputs.webPubSubId
    acrId: acr.outputs.acrId
    aksKubeletPrincipalId: aks.outputs.kubeletIdentityObjectId
  }
}

// --- AZD standard outputs ---
output AZURE_AKS_CLUSTER_NAME string = aks.outputs.clusterName
output AZURE_CONTAINER_REGISTRY_ENDPOINT string = acr.outputs.acrLoginServer
output AZURE_CONTAINER_REGISTRY_NAME string = acr.outputs.acrName

// --- App-specific outputs (available as {{.Env.VAR}} in K8s templates) ---
output EVENT_HUB_NAMESPACE string = eventhub.outputs.fullyQualifiedNamespace
output EVENT_HUB_NAME string = eventhub.outputs.eventHubName
output WEB_PUBSUB_HOSTNAME string = webpubsub.outputs.hostName
output WORKLOAD_IDENTITY_CLIENT_ID string = identity.outputs.identityClientId
output APPLICATIONINSIGHTS_CONNECTION_STRING string = monitoring.outputs.appInsightsConnectionString
output AZURE_LOCATION string = location
