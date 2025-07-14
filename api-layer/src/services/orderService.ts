// src/services/orderService.ts

import type { Order } from "@/generated/prisma";
import { Prisma } from "@/generated/prisma";
import { db } from "@/lib/db";
import type { OrderPayload } from "@/middleware/validator";

export const createOrder = async (data: OrderPayload): Promise<Order> => {
  const remaining = new Prisma.Decimal(data.quantity);
  return db.order.create({
    data: {
      ...data,
      price: new Prisma.Decimal(data.price || 0),
      quantity: new Prisma.Decimal(data.quantity),
      remaining,
      filled: new Prisma.Decimal(0),
      status: "Open",
      // market:
    },
  });
};

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
