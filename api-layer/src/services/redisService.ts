import * as keys from "../constants";
import type { OrderPayload } from "../middleware/validator";
import type { OrderBookLevel, Trade } from "../types";
import { db } from "../lib/db";
import { getTradesByMarket } from "./tradeService";
import { getMarketBySymbol } from "./marketService";
import { Prisma } from "@/generated/prisma";
import { redisManager } from "./redis";
import { v4 as uuidv4 } from "uuid";

const redisClient = redisManager.getClient();

export const submitOrder = async (orderData: OrderPayload, symbol: string) => {
  const orderId = uuidv4();
  const queueName = keys.getOrderQueue(symbol);

  const command = {
    command: "NewOrder",
    payload: {
      id: orderId,
      user_id: orderData.userId,
      order_type: orderData.orderType,
      side: orderData.side,
      price: orderData.price,
      quantity: orderData.quantity,
      timestamp: new Date().toISOString(),
    },
  };

  await redisClient.lPush(queueName, JSON.stringify(command));

  return {
    message: "Order submitted for processing",
    orderId,
    ...command,
  };
};

import * as orderService from "./orderService";

export const cancelOrder = async (symbol: string, orderId: string) => {
  // TODO: This is an optimistic cancellation. A race condition exists where the
  // order might be filled by the matching engine *after* the API user requests
  // cancellation but *before* the engine processes the cancellation message.
  // The correct, robust solution is for the matching engine to be the source
  // of truth and emit an "OrderCanceled" event that a DB worker can process.
  // This implementation is a temporary measure to make the feature work from
  // the user's perspective until the matching engine is updated.
  const canceledOrder = await orderService.cancelOrderAndUnlockFunds(orderId);

  const command = {
    command: "CancelOrder",
    payload: { order_id: orderId },
  };

  const queueName = keys.getCancelQueue(symbol);
  await redisClient.lPush(queueName, JSON.stringify(command));

  return { message: "Cancellation request submitted", order: canceledOrder };
};

export const getOrderBook = async (
  symbol: string,
): Promise<{ bids: OrderBookLevel[]; asks: OrderBookLevel[] }> => {
  const snapshot = await db.orderBookSnapshot.findFirst({
    where: { market: symbol },
    orderBy: { timestamp: "desc" },
  });

  if (!snapshot) {
    return { bids: [], asks: [] };
  }

  // The schema stores bids and asks as JSON, so we parse it.
  // Add type safety check
  const bids = Array.isArray(snapshot.bids)
    ? (snapshot.bids as unknown as OrderBookLevel[])
    : [];
  const asks = Array.isArray(snapshot.asks)
    ? (snapshot.asks as unknown as OrderBookLevel[])
    : [];

  return { bids, asks };
};

export const getLastTradedPrice = async (
  symbol: string,
): Promise<{ symbol: string; last_price: string | null }> => {
  const market = await getMarketBySymbol(symbol);
  return {
    symbol,
    last_price: market
      ? new Prisma.Decimal(market.lastPrice || 0).toString()
      : null,
  };
};

export const getRecentTrades = async (symbol: string): Promise<Trade[]> => {
  const trades = await getTradesByMarket(symbol);

  return trades.map((trade) => ({
    ...trade,
    price: trade.price.toString(),
    quantity: trade.quantity.toString(),
    fee: trade.fee.toString(),
    timestamp: trade.timestamp.toISOString(),
  }));
};
