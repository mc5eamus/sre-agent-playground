const { EventHubConsumerClient } = require("@azure/event-hubs");
const { DefaultAzureCredential } = require("@azure/identity");
const { WebPubSubServiceClient } = require("@azure/web-pubsub");
const { messagesProcessedCounter, processingDuration, consumerLag } = require("./instrumentation");
const { trace } = require("@opentelemetry/api");

const EVENT_HUB_NAMESPACE = process.env.EVENT_HUB_NAMESPACE;
const EVENT_HUB_NAME = process.env.EVENT_HUB_NAME || "messages";
const CONSUMER_GROUP = process.env.CONSUMER_GROUP || "listener";
const WEB_PUBSUB_ENDPOINT = process.env.WEB_PUBSUB_ENDPOINT;
const WEB_PUBSUB_HUB = process.env.WEB_PUBSUB_HUB || "demo";

const credential = new DefaultAzureCredential();

const consumerClient = new EventHubConsumerClient(
  CONSUMER_GROUP,
  EVENT_HUB_NAMESPACE,
  EVENT_HUB_NAME,
  credential
);

const pubsubClient = new WebPubSubServiceClient(
  WEB_PUBSUB_ENDPOINT,
  credential,
  WEB_PUBSUB_HUB
);

function randomDelay(minMs = 100, maxMs = 500) {
  const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise((resolve) => setTimeout(resolve, delay));
}

const tracer = trace.getTracer("listener");

async function processEvent(event) {
  const body = event.body;
  console.log(`Processing message: ${body.id} (${body.index}/${body.total})`);

  // Track consumer lag (time between enqueue and processing)
  if (event.enqueuedTimeUtc) {
    const lagMs = Date.now() - event.enqueuedTimeUtc.getTime();
    consumerLag.record(lagMs, { partitionId: event.partitionKey || "unknown" });
  }

  const processStart = Date.now();

  // Wrap processing in a manual span for tracing
  await tracer.startActiveSpan("process-message", { attributes: {
    "messaging.message_id": body.id,
    "messaging.batch_index": body.index,
    "messaging.batch_total": body.total,
  }}, async (span) => {
    try {
      // Random delay between 100ms and 500ms
      await randomDelay(100, 500);

      const response = {
        type: "processed",
        originalId: body.id,
        message: body.message,
        index: body.index,
        total: body.total,
        processedAt: new Date().toISOString(),
        processingNode: process.env.HOSTNAME || "unknown",
      };

      await pubsubClient.sendToAll(response);

      span.setStatus({ code: 1 }); // OK
    } catch (err) {
      span.setStatus({ code: 2, message: err.message }); // ERROR
      throw err;
    } finally {
      span.end();
    }
  });

  const processDurationMs = Date.now() - processStart;
  messagesProcessedCounter.add(1, { hub: EVENT_HUB_NAME });
  processingDuration.record(processDurationMs, { hub: EVENT_HUB_NAME });
}

const subscription = consumerClient.subscribe({
  processEvents: async (events, _context) => {
    for (const event of events) {
      try {
        await processEvent(event);
      } catch (error) {
        console.error("Error processing event:", error);
      }
    }
  },
  processError: async (error, _context) => {
    console.error("Error receiving events:", error);
  },
});

console.log("Listener started, waiting for events...");

process.on("SIGTERM", async () => {
  console.log("Shutting down listener...");
  await subscription.close();
  await consumerClient.close();
  process.exit(0);
});
