// src/services/userService.ts
import { db } from "../lib/db";
import type { User } from "../generated/prisma/client";

export const createUser = async (data: Omit<User, "id" | "createdAt" | "updatedAt" | "orders" | "balances" | "tradesAsBuyer" | "tradesAsSeller" | "transactions">): Promise<User> => {
  return db.user.create({
    data: {
      ...data,
    },
  });
};

export const getUserById = async (id: string): Promise<User | null> => {
  return db.user.findUnique({
    where: { id },
    include: {
      balances: true,
      orders: true,
    },
  });
};

export const getUserByEmail = async (email: string): Promise<User | null> => {
  return db.user.findUnique({
    where: { email },
    include: {
      balances: true,
      orders: true,
    },
  });
};
