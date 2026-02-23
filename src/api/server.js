const express = require("express");
const cors = require("cors");
const { EventHubProducerClient } = require("@azure/event-hubs");
const { DefaultAzureCredential } = require("@azure/identity");
const { WebPubSubServiceClient } = require("@azure/web-pubsub");
const { v4: uuidv4 } = require("uuid");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;
const EVENT_HUB_NAMESPACE = process.env.EVENT_HUB_NAMESPACE;
const EVENT_HUB_NAME = process.env.EVENT_HUB_NAME || "messages";
const WEB_PUBSUB_ENDPOINT = process.env.WEB_PUBSUB_ENDPOINT;
const WEB_PUBSUB_HUB = process.env.WEB_PUBSUB_HUB || "demo";

const credential = new DefaultAzureCredential();

const producerClient = new EventHubProducerClient(
  EVENT_HUB_NAMESPACE,
  EVENT_HUB_NAME,
  credential
);

const pubsubClient = new WebPubSubServiceClient(
  WEB_PUBSUB_ENDPOINT,
  credential,
  WEB_PUBSUB_HUB
);

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Send messages to Event Hub
app.post("/api/messages", async (req, res) => {
  try {
    const { message, count } = req.body;
    if (!message || !count || count < 1) {
      return res.status(400).json({ error: "message and count (>= 1) are required" });
    }

    const batch = await producerClient.createBatch();
    const messageIds = [];

    for (let i = 0; i < count; i++) {
      const id = uuidv4();
      const payload = {
        id,
        message,
        salt: uuidv4(),
        index: i + 1,
        total: count,
        timestamp: new Date().toISOString(),
      };

      if (!batch.tryAdd({ body: payload })) {
        // If batch is full, send it and create a new one
        await producerClient.sendBatch(batch);
        const newBatch = await producerClient.createBatch();
        if (!newBatch.tryAdd({ body: payload })) {
          throw new Error(`Message at index ${i} is too large for an empty batch`);
        }
      }

      messageIds.push(id);
    }

    await producerClient.sendBatch(batch);

    res.json({
      success: true,
      messageCount: count,
      messageIds,
    });
  } catch (error) {
    console.error("Error sending messages:", error);
    res.status(500).json({ error: "Failed to send messages" });
  }
});

// Negotiate Web PubSub connection
app.get("/api/negotiate", async (_req, res) => {
  try {
    const token = await pubsubClient.getClientAccessToken({
      roles: ["webpubsub.joinLeaveGroup.demo", "webpubsub.sendToGroup.demo"],
    });
    res.json({ url: token.url });
  } catch (error) {
    console.error("Error negotiating PubSub:", error);
    res.status(500).json({ error: "Failed to negotiate connection" });
  }
});

app.listen(PORT, () => {
  console.log(`API server listening on port ${PORT}`);
});
