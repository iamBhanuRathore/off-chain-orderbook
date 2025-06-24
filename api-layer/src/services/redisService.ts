// src/services/redisService.ts

import { createClient } from "redis";
import * as keys from "../constants";
import type { OrderPayload, OrderBookLevel, Trade } from "../types";

const redisClient = createClient({ url: process.env.REDIS_URL });

redisClient.on("error", (err) => console.log("Redis Client Error", err));

(async () => {
  await redisClient.connect();
  console.log("Redis client connected successfully.");
})();

export const submitOrder = async (orderData: OrderPayload) => {
  const { symbol } = orderData;
  const queueName = keys.getOrderQueue(symbol);

  const command = {
    command: "NewOrder",
    payload: {
      user_id: orderData.userId,
      order_type: orderData.orderType,
      side: orderData.side,
      price: orderData.price || "0",
      quantity: orderData.quantity,
    },
  };

  await redisClient.lPush(queueName, JSON.stringify(command));
  return { status: "submitted", details: command.payload };
};

export const cancelOrder = async (symbol: string, orderId: string) => {
  const queueName = keys.getCancelQueue(symbol);

  const command = {
    command: "CancelOrder",
    payload: { order_id: orderId },
  };

  await redisClient.lPush(queueName, JSON.stringify(command));
  return { status: "cancellation_submitted", order_id: orderId };
};

export const getOrderBook = async (symbol: string): Promise<{ bids: OrderBookLevel[]; asks: OrderBookLevel[] }> => {
  const bidsKey = keys.getBidsKey(symbol);
  const asksKey = keys.getAsksKey(symbol);

  const parseLevels = (levels: string[]): OrderBookLevel[] => {
    const priceMap = new Map<string, string>();

    levels.forEach((levelStr) => {
      const [price = "", quantity = ""] = levelStr.split(":");
      if (price && quantity) {
        const currentQty = priceMap.get(price);
        if (!currentQty || parseFloat(quantity) > parseFloat(currentQty)) {
          priceMap.set(price, quantity);
        }
      }
    });

    return Array.from(priceMap.entries()).map(([price, quantity]) => ({
      price,
      quantity,
    }));
  };

  const [bidLevels, askLevels] = await Promise.all([redisClient.zRange(bidsKey, 0, 49, { REV: true }), redisClient.zRange(asksKey, 0, 49)]);
  console.log(bidLevels, askLevels);
  return {
    bids: parseLevels(bidLevels),
    asks: parseLevels(askLevels),
  };
};

export const getLastTradedPrice = async (symbol: string): Promise<{ symbol: string; last_price: string | null }> => {
  const ltpKey = keys.getLtpKey(symbol);
  const ltp = await redisClient.get(ltpKey);
  return { symbol, last_price: ltp || null };
};

export const getRecentTrades = async (symbol: string): Promise<Trade[]> => {
  const tradesKey = keys.getTradesKey(symbol);
  const tradeStrings = await redisClient.lRange(tradesKey, 0, 49);
  return tradeStrings.map((trade) => JSON.parse(trade));
};
