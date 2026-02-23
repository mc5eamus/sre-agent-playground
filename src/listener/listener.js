const { EventHubConsumerClient } = require("@azure/event-hubs");
const { DefaultAzureCredential } = require("@azure/identity");
const { WebPubSubServiceClient } = require("@azure/web-pubsub");

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

async function processEvent(event) {
  const body = event.body;
  console.log(`Processing message: ${body.id} (${body.index}/${body.total})`);

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

  await pubsubClient.sendToAll(JSON.stringify(response));
  console.log(`Sent response for message: ${body.id}`);
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
