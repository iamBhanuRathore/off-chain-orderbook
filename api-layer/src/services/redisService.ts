import * as keys from "../constants";
import type { OrderPayload } from "../middleware/validator";
import type { OrderBookLevel, Trade } from "../types";
import { db } from "../lib/db";
import { createOrderWithBalanceLock } from "./orderService";
import { getTradesByMarket } from "./tradeService";
import { getMarketBySymbol } from "./marketService";
import { Prisma } from "@/generated/prisma";
import { redisManager } from "./redis";
const redisClient = redisManager.getClient();
export const submitOrder = async (orderData: OrderPayload) => {
  const createdOrder = await createOrderWithBalanceLock(
    orderData,
    orderData.symbol,
  );

  const queueName = keys.getOrderQueue(orderData.symbol);
  console.log(createdOrder, queueName);
  const command = {
    command: "NewOrder",
    payload: {
      id: createdOrder.id,
      user_id: createdOrder.userId,
      order_type: createdOrder.orderType,
      side: createdOrder.side,
      price: createdOrder.price.toString(),
      quantity: createdOrder.quantity.toString(),
    },
  };
  await redisClient.lPush(queueName, JSON.stringify(command));
  console.log("Till here");
  return command;
};

export const cancelOrder = async (symbol: string, orderId: string) => {
  const command = {
    command: "CancelOrder",
    payload: { order_id: orderId },
  };

  const queueName = keys.getCancelQueue(symbol);
  await redisClient.lPush(queueName, JSON.stringify(command));

  return { message: "Cancellation request submitted" };
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
