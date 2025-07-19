// src/services/redisService.ts

import { createClient, type RedisClientType } from "redis";
import * as keys from "../constants";
import type { OrderPayload } from "../middleware/validator";
import type { OrderBookLevel, Trade } from "../types";
import { db } from "../lib/db";
import { createOrder, cancelOrder as cancelOrderDb } from "./orderService";
import { getTradesByMarket } from "./tradeService";
import { getMarketBySymbol } from "./marketService";
import { Prisma } from "@/generated/prisma";
import { seedOrdersToDb } from "@/services/seedService";

const redisClient: RedisClientType = createClient({ url: process.env.REDIS_URL });
// export type RedisClientType = typeof redisClient;
redisClient.on("error", (err) => console.log("Redis Client Error", err));

(async () => {
  await redisClient.connect();
  seedOrdersToDb(redisClient);
  // seedTradesToDb(redisClient);
  console.log("Redis client connected successfully.");
})();

export const submitOrder = async (orderData: OrderPayload) => {
  // const createdOrder = await createOrder(orderData);

  const queueName = keys.getOrderQueue(orderData.symbol);

  const command = {
    command: "NewOrder",
    payload: {
      user_id: orderData.userId,
      order_type: orderData.orderType,
      side: orderData.side,
      price: orderData.price ? orderData.price.toString() : "0",
      quantity: orderData.quantity.toString(),
    },
  };
  await redisClient.lPush(queueName, JSON.stringify(command));
  return command;
};

export const cancelOrder = async (symbol: string, orderId: string) => {
  const updatedOrder = await cancelOrderDb(orderId);

  const queueName = keys.getCancelQueue(symbol);

  const command = {
    command: "CancelOrder",
    payload: { order_id: orderId },
  };

  await redisClient.lPush(queueName, JSON.stringify(command));
  return updatedOrder;
};

export const getOrderBook = async (symbol: string): Promise<{ bids: OrderBookLevel[]; asks: OrderBookLevel[] }> => {
  const snapshot = await db.orderBookSnapshot.findFirst({
    where: { market: symbol },
    orderBy: { timestamp: "desc" },
  });

  if (!snapshot) {
    return { bids: [], asks: [] };
  }

  // The schema stores bids and asks as JSON, so we parse it.
  // Add type safety check
  const bids = Array.isArray(snapshot.bids) ? (snapshot.bids as unknown as OrderBookLevel[]) : [];
  const asks = Array.isArray(snapshot.asks) ? (snapshot.asks as unknown as OrderBookLevel[]) : [];

  return { bids, asks };
};

export const getLastTradedPrice = async (symbol: string): Promise<{ symbol: string; last_price: string | null }> => {
  const market = await getMarketBySymbol(symbol);
  return {
    symbol,
    last_price: market ? new Prisma.Decimal(market.lastPrice || 0).toString() : null,
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
