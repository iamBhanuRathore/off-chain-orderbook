// src/services/tradeService.ts
import { db } from "../lib/db";
import { Prisma } from "../generated/prisma/client";
import type { Trade } from "../generated/prisma/client";

export const createTrade = async (data: Omit<Trade, "id" | "timestamp" | "buyOrder" | "sellOrder" | "buyer" | "seller">): Promise<Trade> => {
  return db.trade.create({
    data: {
      ...data,
      price: new Prisma.Decimal(data.price),
      quantity: new Prisma.Decimal(data.quantity),
      fee: new Prisma.Decimal(data.fee),
    },
  });
};

export const getTradesByMarket = async (market: string): Promise<Trade[]> => {
  return db.trade.findMany({
    where: { market },
    orderBy: { timestamp: "desc" },
    take: 100,
  });
};
