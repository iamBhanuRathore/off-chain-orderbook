// src/services/orderService.ts

import type { Order } from "@/generated/prisma";
import { Prisma } from "@/generated/prisma";
import { db } from "@/lib/db";
import type { OrderSchema } from "@/types";

export const createOrder = async (data: OrderSchema, market: string): Promise<Order> => {
  return db.order.create({
    data: {
      userId: data.user_id,
      orderType: data.order_type,
      side: data.side,
      market: market,
      price: new Prisma.Decimal(data.price || 0),
      quantity: new Prisma.Decimal(data.quantity),
      remaining: new Prisma.Decimal(data.quantity),
      filled: 0,
      status: "Open",
    },
  });
};
// export const createTrade =

export const getOrderById = async (id: string): Promise<Order | null> => {
  return db.order.findUnique({
    where: { id },
  });
};

export const getOrdersByUserId = async (userId: string): Promise<Order[]> => {
  return db.order.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
};

export const cancelOrder = async (id: string): Promise<Order | null> => {
  return db.order.update({
    where: { id },
    data: { status: "Canceled", canceledAt: new Date() },
  });
};
