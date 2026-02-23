# AKS Chaos Studio Demo

Minimal infrastructure and sample applications for demonstrating [Azure Chaos Studio](https://learn.microsoft.com/en-us/azure/chaos-studio/) targeting AKS, with end-to-end observability using Azure native tools.

## Architecture

```
┌──────────┐    REST     ┌──────────┐   Event Hub   ┌──────────┐
│ Frontend │───────────▶│   API    │──────────────▶│ Listener │
│(React/   │            │(Express) │               │(Node.js) │
│ Vite)    │◀───────────│          │               │          │
└──────────┘  WebSocket  └──────────┘               └────┬─────┘
      ▲        (via Web PubSub)                          │
      │                                                  │
      └────────────── Azure Web PubSub ◀─────────────────┘
```

**Message flow:** Frontend → API → Event Hub → Listener → Web PubSub → Frontend

## Azure Resources

All resources are deployed via a single Bicep template:

| Resource | Purpose |
|---|---|
| **AKS Cluster** | Hosts the demo applications (1 node, non-scalable) |
| **Event Hub** | Message broker between API and Listener |
| **Application Insights** | Telemetry collection from AKS workloads |
| **Log Analytics Workspace** | Centralized logging for AKS and applications |
| **Web PubSub** | Real-time WebSocket communication to frontend |
| **Container Registry (ACR)** | Private registry for container images |
| **Managed Identity** | Workload identity for secure Azure service access |

## Project Structure

```
├── azure.yaml                # Azure Developer CLI project definition
├── infra/                    # Bicep infrastructure templates
│   ├── main.bicep            # Main orchestration template
│   └── modules/
│       ├── acr.bicep          # Azure Container Registry
│       ├── aks.bicep          # AKS cluster
│       ├── eventhub.bicep     # Event Hub namespace and hub
│       ├── identity.bicep     # Managed identity + federated credentials
│       ├── monitoring.bicep   # Log Analytics + Application Insights
│       ├── roleassignments.bicep # RBAC role assignments
│       └── webpubsub.bicep    # Web PubSub service
├── src/
│   ├── api/                   # REST API (Express/Node.js)
│   │   └── manifests/         # K8s manifests for azd deploy
│   ├── frontend/              # Frontend (React/Vite)
│   │   └── manifests/         # K8s manifests for azd deploy
│   └── listener/              # Event Hub listener (Node.js)
│       └── manifests/         # K8s manifests for azd deploy
├── k8s/                       # Kubernetes manifests (manual/envsubst)
│   ├── api.yaml               # API deployment + service + service account
│   ├── frontend.yaml          # Frontend deployment + LoadBalancer service
│   └── listener.yaml          # Listener deployment + service account
└── README.md
```

## Prerequisites

- [Azure CLI](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli)
- [Azure Developer CLI (`azd`)](https://learn.microsoft.com/en-us/azure/developer/azure-developer-cli/install-azd) — recommended for one-command deployment
- [Bicep CLI](https://learn.microsoft.com/en-us/azure/azure-resource-manager/bicep/install) (or use via Azure CLI)
- [kubectl](https://kubernetes.io/docs/tasks/tools/)
- [Docker](https://docs.docker.com/get-docker/)
- An Azure subscription with permissions to create resources

## Setup

### Option A: Deploy with `azd` (Recommended)

The project is configured for [Azure Developer CLI](https://learn.microsoft.com/en-us/azure/developer/azure-developer-cli/overview).

```bash
# Login to Azure
azd auth login

# Provision infrastructure and deploy all services in one step
azd up
```

This will:
1. Provision all Azure resources (AKS, Event Hub, ACR, Web PubSub, etc.)
2. Build Docker images for all three services
3. Push images to the provisioned ACR
4. Deploy K8s manifests to AKS

You can also run each step separately:

```bash
azd provision   # Provision infrastructure only
azd deploy      # Build, push, and deploy services only
```

To view the environment values (Bicep outputs):

```bash
azd env get-values
```

### Option B: Deploy with Azure CLI

```bash
# Login to Azure
az login

# Create a resource group
az group create --name rg-chaos-demo --location eastus

# Deploy infrastructure
az deployment group create \
  --resource-group rg-chaos-demo \
  --template-file infra/main.bicep \
  --parameters baseName=chaosdemo

# Capture outputs
AKS_NAME=$(az deployment group show -g rg-chaos-demo -n main --query properties.outputs.aksClusterName.value -o tsv)
EH_NAMESPACE=$(az deployment group show -g rg-chaos-demo -n main --query properties.outputs.eventHubNamespace.value -o tsv)
WPS_HOST=$(az deployment group show -g rg-chaos-demo -n main --query properties.outputs.webPubSubHostName.value -o tsv)
IDENTITY_CLIENT_ID=$(az deployment group show -g rg-chaos-demo -n main --query properties.outputs.workloadIdentityClientId.value -o tsv)
ACR_NAME=$(az deployment group show -g rg-chaos-demo -n main --query properties.outputs.acrName.value -o tsv)
```

### 2. Build and Push Container Images

```bash
# Login to ACR
az acr login --name $ACR_NAME

# Build and push images
docker build -t $ACR_NAME.azurecr.io/chaos-demo-api:latest src/api/
docker push $ACR_NAME.azurecr.io/chaos-demo-api:latest

docker build -t $ACR_NAME.azurecr.io/chaos-demo-listener:latest src/listener/
docker push $ACR_NAME.azurecr.io/chaos-demo-listener:latest

docker build -t $ACR_NAME.azurecr.io/chaos-demo-frontend:latest src/frontend/
docker push $ACR_NAME.azurecr.io/chaos-demo-frontend:latest
```

### 3. Deploy to AKS

```bash
# Get AKS credentials
az aks get-credentials --resource-group rg-chaos-demo --name $AKS_NAME

# Replace placeholders in K8s manifests and apply
# (replace ${...} placeholders with actual values from deployment outputs)
export ACR_NAME=$ACR_NAME EVENT_HUB_NAMESPACE=$EH_NAMESPACE WEB_PUBSUB_HOSTNAME=$WPS_HOST WORKLOAD_IDENTITY_CLIENT_ID=$IDENTITY_CLIENT_ID

envsubst < k8s/api.yaml | kubectl apply -f -
envsubst < k8s/listener.yaml | kubectl apply -f -
envsubst < k8s/frontend.yaml | kubectl apply -f -
```

### 4. Access the Frontend

```bash
# Get the frontend external IP
kubectl get svc frontend-service -w
```

Open the external IP in your browser to access the demo application.

## Verification

1. **Frontend loads** — Open the frontend URL in a browser.
2. **WebSocket connects** — The status indicator shows "Connected" (green dot).
3. **Send messages** — Enter a message and count, click "Send".
4. **Events appear** — Processed events stream into the events panel in real-time.
5. **Check telemetry** — Open Application Insights in the Azure portal to view telemetry from AKS workloads.

## Chaos Studio Scenarios

This infrastructure is designed for demonstrating these Azure Chaos Studio experiments:

| Scenario | Target | Expected Impact |
|---|---|---|
| **AKS Pod Chaos** | Kill API or Listener pods | Message processing interruption, observe recovery |
| **AKS Network Chaos** | Network latency/loss on AKS nodes | Increased processing time, potential timeouts |
| **AKS Stress Chaos** | CPU/memory stress on AKS nodes | Degraded performance, potential OOM kills |
| **AKS DNS Chaos** | DNS failures on AKS nodes | Service discovery failures, connection errors |

### Setting Up a Chaos Experiment

1. Navigate to **Azure Chaos Studio** in the Azure portal.
2. Enable targets: Select the AKS cluster as a target.
3. Create an experiment: Choose a fault type (e.g., Pod Chaos — pod-failure).
4. Define scope: Target specific pods using label selectors (e.g., `app=api` or `app=listener`).
5. Run the experiment and observe the impact on the frontend events panel and Application Insights.

## Applications

### API (`src/api/`)
- **POST /api/messages** — Send `{ message, count }` to publish messages to Event Hub.
- **GET /api/negotiate** — Get a Web PubSub client access token for WebSocket connection.
- **GET /health** — Health check endpoint.

### Listener (`src/listener/`)
- Subscribes to Event Hub consumer group `listener`.
- Processes each message with a random delay (100–500ms).
- Sends processed results to all Web PubSub clients.

### Frontend (`src/frontend/`)
- React/Vite single-page application.
- Form to specify message text and copy count.
- Auto-scrolling events panel showing processed messages in real-time.
- WebSocket connection status indicator.

## Cleanup

```bash
az group delete --name rg-chaos-demo --yes --no-wait
```