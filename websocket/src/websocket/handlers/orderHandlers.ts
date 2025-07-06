// src/websocket/handlers/orderHandlers.ts
import { isSymbolEnabled } from "@/config";
import { redisService } from "@/services/redisService";
import type { CancelOrderPayload, ClientWebSocket, PlaceOrderPayload } from "@/types";
import { sendError, sendMessage } from "@/websocket/utils";

export async function handlePlaceOrder(ws: ClientWebSocket, payload: PlaceOrderPayload) {
  const { symbol, user_id, order_type, side, price, quantity } = payload;
  if (!symbol || !user_id || !order_type || !side || !quantity) {
    return sendError(ws, "bad_request", "Missing required order parameters.");
  }
  if (!isSymbolEnabled(symbol)) {
    return sendError(ws, "bad_request", `Trading pair '${symbol}' is not enabled.`);
  }

  try {
    const order = {
      user_id: parseInt(user_id, 10),
      order_type,
      side,
      price: price || "0",
      quantity: quantity.toString(),
    };

    await redisService.publishNewOrder(symbol, order);
    sendMessage(ws, { event: "order_submitted", payload });
    console.log(`Order placed for ${symbol}: ${side} ${quantity} @ ${price || "Market"}`);
  } catch (error) {
    sendError(ws, "order_error", (error as Error).message);
  }
}

export async function handleCancelOrder(ws: ClientWebSocket, payload: CancelOrderPayload) {
  const { symbol, order_id } = payload;
  if (!symbol || !order_id) {
    return sendError(ws, "bad_request", "Missing symbol or order_id.");
  }
  if (!isSymbolEnabled(symbol)) {
    return sendError(ws, "bad_request", `Trading pair '${symbol}' is not enabled.`);
  }

  try {
    await redisService.publishCancelOrder(symbol, { order_id });
    sendMessage(ws, { event: "cancel_submitted", payload });
    console.log(`Cancel order submitted for ${symbol}: ${order_id}`);
  } catch (error) {
    sendError(ws, "cancel_error", (error as Error).message);
  }
}
