// src/websocket/handlers/subscriptionHandlers.ts
import { isSymbolEnabled } from "@/config";
import type { ClientWebSocket, SubscriptionPayload } from "@/types";
import { connectionManager } from "@/websocket/connectionManager";
import { sendError, sendMessage } from "@/websocket/utils";

const getChannelsForSymbol = (symbol: string) => {
  const symbolKey = symbol.replace("/", "_");
  return [`orderbook:deltas:${symbolKey}`, `orderbook:trades:${symbolKey}`];
};

export function handleSubscribe(ws: ClientWebSocket, payload: SubscriptionPayload) {
  const { symbol } = payload;
  if (!symbol) {
    return sendError(ws, "bad_request", "Symbol is required for subscription.");
  }
  if (!isSymbolEnabled(symbol)) {
    return sendError(ws, "bad_request", `Trading pair '${symbol}' is not enabled.`);
  }

  const channels = getChannelsForSymbol(symbol);
  channels.forEach((channel) => connectionManager.subscribe(ws.id, channel));

  sendMessage(ws, { event: "subscribed", payload: { symbol, channels } });
  console.log(`Client ${ws.id} subscribed to ${symbol}`);
}

export function handleUnsubscribe(ws: ClientWebSocket, payload: SubscriptionPayload) {
  const { symbol } = payload;
  if (!symbol) {
    return sendError(ws, "bad_request", "Symbol is required for unsubscription.");
  }

  const channels = getChannelsForSymbol(symbol);
  channels.forEach((channel) => connectionManager.unsubscribe(ws.id, channel));

  sendMessage(ws, { event: "unsubscribed", payload: { symbol } });
  console.log(`Client ${ws.id} unsubscribed from ${symbol}`);
}
