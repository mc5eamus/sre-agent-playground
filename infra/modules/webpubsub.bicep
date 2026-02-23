@description('Name of the Web PubSub service')
param webPubSubName string

@description('Location for the Web PubSub service')
param location string = resourceGroup().location

resource webPubSub 'Microsoft.SignalRService/webPubSub@2024-01-01-preview' = {
  name: webPubSubName
  location: location
  sku: {
    name: 'Free_F1'
    capacity: 1
  }
  properties: {}
}

output webPubSubName string = webPubSub.name
output webPubSubId string = webPubSub.id
output hostName string = webPubSub.properties.hostName
