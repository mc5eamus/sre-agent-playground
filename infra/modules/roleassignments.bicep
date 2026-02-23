@description('Principal ID of the managed identity')
param principalId string

@description('Event Hub namespace resource ID')
param eventHubNamespaceId string

@description('Web PubSub resource ID')
param webPubSubId string

@description('ACR resource ID')
param acrId string

@description('AKS kubelet identity principal ID for ACR pull')
param aksKubeletPrincipalId string

// Azure Event Hubs Data Sender
resource eventHubsDataSenderRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(eventHubNamespaceId, principalId, 'EventHubsDataSender')
  properties: {
    principalId: principalId
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '2b629674-e913-4c01-ae53-ef4638d8f975')
    principalType: 'ServicePrincipal'
  }
}

// Azure Event Hubs Data Receiver
resource eventHubsDataReceiverRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(eventHubNamespaceId, principalId, 'EventHubsDataReceiver')
  properties: {
    principalId: principalId
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'a638d3c7-ab3a-418d-83e6-5f17a39d4fde')
    principalType: 'ServicePrincipal'
  }
}

// Web PubSub Service Owner
resource webPubSubServiceOwnerRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(webPubSubId, principalId, 'WebPubSubServiceOwner')
  properties: {
    principalId: principalId
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '12cf5a90-567b-43ae-8102-96cf46c7d9b4')
    principalType: 'ServicePrincipal'
  }
}

// AcrPull for AKS kubelet identity
resource acrPullRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(acrId, aksKubeletPrincipalId, 'AcrPull')
  properties: {
    principalId: aksKubeletPrincipalId
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d')
    principalType: 'ServicePrincipal'
  }
}
