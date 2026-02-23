@description('Managed Identity name for workload identity')
param identityName string

@description('Location for resources')
param location string = resourceGroup().location

@description('AKS OIDC Issuer URL')
param aksOidcIssuerUrl string

@description('Kubernetes namespace for the workload')
param k8sNamespace string = 'default'

@description('Kubernetes service account name for the API')
param apiServiceAccountName string = 'api-sa'

@description('Kubernetes service account name for the listener')
param listenerServiceAccountName string = 'listener-sa'

resource managedIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: identityName
  location: location
}

resource apiFederatedCredential 'Microsoft.ManagedIdentity/userAssignedIdentities/federatedIdentityCredentials@2023-01-31' = {
  parent: managedIdentity
  name: 'api-federated-credential'
  properties: {
    issuer: aksOidcIssuerUrl
    subject: 'system:serviceaccount:${k8sNamespace}:${apiServiceAccountName}'
    audiences: [
      'api://AzureADTokenExchange'
    ]
  }
}

resource listenerFederatedCredential 'Microsoft.ManagedIdentity/userAssignedIdentities/federatedIdentityCredentials@2023-01-31' = {
  parent: managedIdentity
  name: 'listener-federated-credential'
  properties: {
    issuer: aksOidcIssuerUrl
    subject: 'system:serviceaccount:${k8sNamespace}:${listenerServiceAccountName}'
    audiences: [
      'api://AzureADTokenExchange'
    ]
  }
}

output identityName string = managedIdentity.name
output identityClientId string = managedIdentity.properties.clientId
output identityPrincipalId string = managedIdentity.properties.principalId
