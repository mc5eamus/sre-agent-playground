targetScope = 'resourceGroup'

@description('Base name for all resources')
param baseName string

@description('Location for all resources')
param location string = resourceGroup().location

@description('Kubernetes namespace for workloads')
param k8sNamespace string = 'default'

// --- Monitoring ---
module monitoring 'modules/monitoring.bicep' = {
  name: 'monitoring'
  params: {
    logAnalyticsName: '${baseName}-logs'
    appInsightsName: '${baseName}-ai'
    location: location
  }
}

// --- AKS Cluster ---
module aks 'modules/aks.bicep' = {
  name: 'aks'
  params: {
    clusterName: '${baseName}-aks'
    location: location
    logAnalyticsWorkspaceId: monitoring.outputs.logAnalyticsWorkspaceId
  }
}

// --- Event Hub ---
module eventhub 'modules/eventhub.bicep' = {
  name: 'eventhub'
  params: {
    namespaceName: '${baseName}-ehns'
    location: location
  }
}

// --- Web PubSub ---
module webpubsub 'modules/webpubsub.bicep' = {
  name: 'webpubsub'
  params: {
    webPubSubName: '${baseName}-wps'
    location: location
  }
}

// --- Workload Identity ---
module identity 'modules/identity.bicep' = {
  name: 'identity'
  params: {
    identityName: '${baseName}-id'
    location: location
    aksOidcIssuerUrl: aks.outputs.oidcIssuerUrl
    k8sNamespace: k8sNamespace
  }
}

// --- Role Assignments ---

// Azure Event Hubs Data Sender role for the managed identity
resource eventHubsDataSenderRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(resourceGroup().id, identity.outputs.identityPrincipalId, 'EventHubsDataSender')
  properties: {
    principalId: identity.outputs.identityPrincipalId
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '2b629674-e913-4c01-ae53-ef4638d8f975')
    principalType: 'ServicePrincipal'
  }
}

// Azure Event Hubs Data Receiver role for the managed identity
resource eventHubsDataReceiverRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(resourceGroup().id, identity.outputs.identityPrincipalId, 'EventHubsDataReceiver')
  properties: {
    principalId: identity.outputs.identityPrincipalId
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'a638d3c7-ab3a-418d-83e6-5f17a39d4fde')
    principalType: 'ServicePrincipal'
  }
}

// Web PubSub Service Owner role for the managed identity
resource webPubSubServiceOwnerRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(resourceGroup().id, identity.outputs.identityPrincipalId, 'WebPubSubServiceOwner')
  properties: {
    principalId: identity.outputs.identityPrincipalId
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '12cf5a90-567b-43ae-8102-96cf46c7d9b4')
    principalType: 'ServicePrincipal'
  }
}

// --- Outputs ---
output aksClusterName string = aks.outputs.clusterName
output aksClusterFqdn string = aks.outputs.clusterFqdn
output eventHubNamespace string = eventhub.outputs.fullyQualifiedNamespace
output eventHubName string = eventhub.outputs.eventHubName
output webPubSubHostName string = webpubsub.outputs.hostName
output appInsightsConnectionString string = monitoring.outputs.appInsightsConnectionString
output workloadIdentityClientId string = identity.outputs.identityClientId
output logAnalyticsWorkspaceName string = monitoring.outputs.logAnalyticsWorkspaceName
