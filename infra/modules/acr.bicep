@description('Name of the Azure Container Registry')
param acrName string

@description('Location for the ACR')
param location string = resourceGroup().location

@description('SKU for the ACR')
param sku string = 'Basic'

resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: acrName
  location: location
  sku: {
    name: sku
  }
  properties: {
    adminUserEnabled: false
  }
}

output acrName string = acr.name
output acrLoginServer string = acr.properties.loginServer
output acrId string = acr.id
