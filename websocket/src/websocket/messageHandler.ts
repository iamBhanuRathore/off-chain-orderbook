// src/websocket/messageHandler.ts
import type { ClientMessage, ClientWebSocket } from "@/types";
import { handleGetRedisOrderbook, handleSnapshotRequest } from "@/websocket/handlers/dataHandlers";
import { handleCancelOrder, handlePlaceOrder } from "@/websocket/handlers/orderHandlers";
import { handleSubscribe, handleUnsubscribe } from "@/websocket/handlers/subscriptionHandlers";
import { sendError } from "@/websocket/utils";

export function handleMessage(ws: ClientWebSocket, rawMessage: string | Buffer) {
  let message: ClientMessage;
  try {
    message = JSON.parse(rawMessage.toString());
  } catch (error) {
    return sendError(ws, "invalid_json", "Message must be valid JSON.");
  }

  // Type guard for message structure
  if (!message.event || !message.payload) {
    return sendError(ws, "bad_request", "Message must have 'event' and 'payload' properties.");
  }

  switch (message.event) {
    case "place_order":
      handlePlaceOrder(ws, message.payload);
      break;
    case "cancel_order":
      handleCancelOrder(ws, message.payload);
      break;
    case "subscribe_orderbook":
      handleSubscribe(ws, message.payload);
      break;
    case "unsubscribe_orderbook":
      handleUnsubscribe(ws, message.payload);
      break;
    case "request_snapshot":
      handleSnapshotRequest(ws, message.payload);
      break;
    case "get_redis_orderbook":
      handleGetRedisOrderbook(ws, message.payload);
      break;
    default:
      sendError(ws, "unknown_event", `Unknown event type: ${(message as any).event}`);
  }
}
