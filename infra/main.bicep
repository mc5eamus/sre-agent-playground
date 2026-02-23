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

// --- Container Registry ---
module acr 'modules/acr.bicep' = {
  name: 'acr'
  params: {
    acrName: replace('${baseName}acr', '-', '')
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
module roleAssignments 'modules/roleassignments.bicep' = {
  name: 'roleAssignments'
  params: {
    principalId: identity.outputs.identityPrincipalId
    eventHubNamespaceId: eventhub.outputs.namespaceId
    webPubSubId: webpubsub.outputs.webPubSubId
    acrId: acr.outputs.acrId
    aksKubeletPrincipalId: aks.outputs.kubeletIdentityObjectId
  }
}

// --- Outputs ---
output AZURE_AKS_CLUSTER_NAME string = aks.outputs.clusterName
output AZURE_CONTAINER_REGISTRY_ENDPOINT string = acr.outputs.acrLoginServer
output aksClusterName string = aks.outputs.clusterName
output aksClusterFqdn string = aks.outputs.clusterFqdn
output eventHubNamespace string = eventhub.outputs.fullyQualifiedNamespace
output eventHubName string = eventhub.outputs.eventHubName
output webPubSubHostName string = webpubsub.outputs.hostName
output appInsightsConnectionString string = monitoring.outputs.appInsightsConnectionString
output workloadIdentityClientId string = identity.outputs.identityClientId
output logAnalyticsWorkspaceName string = monitoring.outputs.logAnalyticsWorkspaceName
output acrLoginServer string = acr.outputs.acrLoginServer
output acrName string = acr.outputs.acrName
