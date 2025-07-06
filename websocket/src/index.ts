import type { ClientWebSocket } from "@/types";
import { handleHttpRequest } from "@/api/httpHandlers";
import { tradingPairs } from "@/config";
import { redisService } from "@/services/redisService";
import { connectionManager } from "@/websocket/connectionManager";
import { sendMessage } from "@/websocket/utils";
import { handleMessage } from "@/websocket/messageHandler";

// --- Initialize Redis Pub/Sub Listener ---
const redisChannels = tradingPairs.flatMap((pair) => {
  const symbolKey = `${pair.base_asset}_${pair.quote_asset}`;
  return [`orderbook:deltas:${symbolKey}`, `orderbook:trades:${symbolKey}`];
});

redisService.subscribe(redisChannels, (channel, message) => {
  try {
    const data = JSON.parse(message);
    let eventType: "orderbook_delta" | "trade";

    if (channel.includes(":deltas:")) {
      eventType = "orderbook_delta";
    } else if (channel.includes(":trades:")) {
      eventType = "trade";
    } else {
      return;
    }

    connectionManager.broadcastToChannel(channel, {
      event: eventType,
      payload: { channel, ...data },
    });
  } catch (error) {
    console.error(`Error processing Redis message from ${channel}:`, error);
  }
});

// --- Initialize Bun Server ---
const port = 4000;
const server = Bun.serve({
  port,
  fetch(req, server) {
    // Upgrade to WebSocket if the header is present
    if (server.upgrade(req)) {
      return;
    }
    // Handle regular HTTP requests
    return handleHttpRequest(req);
  },
  websocket: {
    open(ws: ClientWebSocket) {
      connectionManager.add(ws);
      // Send available trading pairs on successful connection
      sendMessage(ws, { event: "trading_pairs", payload: tradingPairs });
    },
    message(ws: ClientWebSocket, message) {
      handleMessage(ws, message);
    },
    close(ws: ClientWebSocket) {
      connectionManager.remove(ws.id);
    },
  },
});

console.log(`Trading Server running on http://localhost:${server.port}`);

// --- Graceful Shutdown ---
async function shutdown() {
  console.log("\nShutting down gracefully...");
  await redisService.shutdown();
  server.stop(true); // true = exit process after stopping
  console.log("Server stopped.");
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
