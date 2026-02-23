const { useAzureMonitor } = require("@azure/monitor-opentelemetry");
const { metrics, trace } = require("@opentelemetry/api");

process.env.OTEL_SERVICE_NAME = "api";

useAzureMonitor({
  azureMonitorExporterOptions: {
    connectionString: process.env.APPLICATIONINSIGHTS_CONNECTION_STRING,
  },
  instrumentationOptions: {
    http: { enabled: true },
    azureSdk: { enabled: true },
  },
});

// Create custom meters and counters for use in server.js
const meter = metrics.getMeter("api-custom-metrics");

const messagesSentCounter = meter.createCounter("messages.sent.count", {
  description: "Number of messages sent to Event Hub",
});

const messagesSentDuration = meter.createHistogram("messages.sent.duration", {
  description: "Duration of sending a batch to Event Hub (ms)",
  unit: "ms",
});

const negotiateCounter = meter.createCounter("negotiate.count", {
  description: "Number of Web PubSub negotiate requests",
});

module.exports = { messagesSentCounter, messagesSentDuration, negotiateCounter };
