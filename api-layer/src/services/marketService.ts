// src/services/marketService.ts
import { Prisma, type Market } from "@/generated/prisma";
import { db } from "@/lib/db";

export const createMarket = async (data: Omit<Market, "id" | "createdAt" | "updatedAt">): Promise<Market> => {
  return db.market.create({
    data: {
      ...data,
      minPrice: new Prisma.Decimal(data.minPrice),
      maxPrice: new Prisma.Decimal(data.maxPrice),
      tickSize: new Prisma.Decimal(data.tickSize),
      minQuantity: new Prisma.Decimal(data.minQuantity),
      maxQuantity: new Prisma.Decimal(data.maxQuantity),
      stepSize: new Prisma.Decimal(data.stepSize),
    },
  });
};

export const getMarketBySymbol = async (symbol: string): Promise<Market | null> => {
  return db.market.findUnique({
    where: { symbol },
  });
};

export const getAllMarkets = async (): Promise<Market[]> => {
  return db.market.findMany();
};
