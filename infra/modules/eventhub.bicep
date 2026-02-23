@description('Name of the Event Hub namespace')
param namespaceName string

@description('Name of the Event Hub')
param eventHubName string = 'messages'

@description('Location for the Event Hub namespace')
param location string = resourceGroup().location

resource eventHubNamespace 'Microsoft.EventHub/namespaces@2024-01-01' = {
  name: namespaceName
  location: location
  sku: {
    name: 'Standard'
    tier: 'Standard'
    capacity: 1
  }
}

resource eventHub 'Microsoft.EventHub/namespaces/eventhubs@2024-01-01' = {
  parent: eventHubNamespace
  name: eventHubName
  properties: {
    partitionCount: 2
    messageRetentionInDays: 1
  }
}

resource consumerGroup 'Microsoft.EventHub/namespaces/eventhubs/consumergroups@2024-01-01' = {
  parent: eventHub
  name: 'listener'
}

output namespaceName string = eventHubNamespace.name
output eventHubName string = eventHub.name
output namespaceId string = eventHubNamespace.id
output fullyQualifiedNamespace string = '${eventHubNamespace.name}.servicebus.windows.net'
