#!/usr/bin/env pwsh

# Post-provision hook: gets AKS credentials for kubectl access

Write-Host "=== Post-provision setup ==="

# Get AKS credentials for kubectl
$clusterName = azd env get-value AZURE_AKS_CLUSTER_NAME
$resourceGroup = azd env get-value AZURE_RESOURCE_GROUP

Write-Host "Getting AKS credentials for cluster '$clusterName' in resource group '$resourceGroup'..."
az aks get-credentials --resource-group $resourceGroup --name $clusterName --overwrite-existing
if ($LASTEXITCODE -ne 0) { Write-Error "Failed to get AKS credentials"; exit 1 }

Write-Host "=== Post-provision setup complete ==="
