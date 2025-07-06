// src/websocket/handlers/dataHandlers.ts
import { isSymbolEnabled } from "@/config";
import { redisService } from "@/services/redisService";
import type { ClientWebSocket, RedisOrderbookPayload, SnapshotRequestPayload } from "@/types";
import { sendError, sendMessage } from "@/websocket/utils";
import { Redis } from "ioredis";

export async function handleSnapshotRequest(ws: ClientWebSocket, payload: SnapshotRequestPayload) {
  const { symbol } = payload;
  if (!symbol) {
    return sendError(ws, "bad_request", "Symbol is required for snapshot request.");
  }
  if (!isSymbolEnabled(symbol)) {
    return sendError(ws, "bad_request", `Trading pair '${symbol}' is not enabled.`);
  }

  // This logic with a temporary Redis subscriber is complex and can be risky.
  // A better pattern is a request-response over a dedicated Redis channel,
  // but we will keep the original logic for now.
  const responseChannel = `snapshot_resp:${ws.id}_${Date.now()}`;
  const tempSubscriber = new Redis(redisService.subscriber.options);

  const timeout = setTimeout(() => {
    tempSubscriber.unsubscribe(responseChannel).catch(console.error);
    tempSubscriber.disconnect();
    sendError(ws, "snapshot_timeout", "Snapshot request timed out.");
  }, 5000);

  tempSubscriber.on("message", (channel, message) => {
    if (channel === responseChannel) {
      clearTimeout(timeout);
      try {
        sendMessage(ws, { event: "orderbook_snapshot", payload: JSON.parse(message) });
      } catch (e) {
        sendError(ws, "snapshot_parse_error", "Failed to parse snapshot data.");
      } finally {
        tempSubscriber.unsubscribe(responseChannel).catch(console.error);
        tempSubscriber.disconnect();
      }
    }
  });

  try {
    await tempSubscriber.subscribe(responseChannel);
    await redisService.requestSnapshot(symbol, responseChannel);
    console.log(`Snapshot requested for ${symbol} by client ${ws.id}`);
  } catch (error) {
    clearTimeout(timeout);
    tempSubscriber.disconnect();
    sendError(ws, "snapshot_error", (error as Error).message);
  }
}

export async function handleGetRedisOrderbook(ws: ClientWebSocket, payload: RedisOrderbookPayload) {
  const { symbol, limit = 10 } = payload;
  if (!symbol) {
    return sendError(ws, "bad_request", "Symbol is required.");
  }
  if (!isSymbolEnabled(symbol)) {
    return sendError(ws, "bad_request", `Trading pair '${symbol}' is not enabled.`);
  }

  try {
    const orderbookData = await redisService.getOrderbook(symbol, limit);
    sendMessage(ws, { event: "redis_orderbook", payload: { symbol, ...orderbookData } });
  } catch (error) {
    sendError(ws, "redis_orderbook_error", (error as Error).message);
  }
}
