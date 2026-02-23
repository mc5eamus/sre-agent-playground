const { useAzureMonitor } = require("@azure/monitor-opentelemetry");
const { metrics, trace } = require("@opentelemetry/api");

process.env.OTEL_SERVICE_NAME = "listener";

useAzureMonitor({
  azureMonitorExporterOptions: {
    connectionString: process.env.APPLICATIONINSIGHTS_CONNECTION_STRING,
  },
  instrumentationOptions: {
    http: { enabled: true },
    azureSdk: { enabled: true },
  },
});

// Create custom meters and counters for use in listener.js
const meter = metrics.getMeter("listener-custom-metrics");

const messagesProcessedCounter = meter.createCounter("messages.processed.count", {
  description: "Number of messages processed from Event Hub",
});

const processingDuration = meter.createHistogram("messages.processing.duration", {
  description: "Duration of processing a single message (ms)",
  unit: "ms",
});

const consumerLag = meter.createHistogram("consumer.lag", {
  description: "Lag between event enqueue time and processing time (ms)",
  unit: "ms",
});

module.exports = { messagesProcessedCounter, processingDuration, consumerLag };
