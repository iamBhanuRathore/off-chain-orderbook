// src/services/orderService.ts

import type { Order } from "@/generated/prisma";
import { Prisma, Side, OrderStatus } from "@/generated/prisma";
import { db } from "@/lib/db";
import type { OrderPayload } from "@/middleware/validator";
import type { OrderSchema } from "@/types"; // Make sure this path is correct

/**
 * DEPRECATED: This is an unsafe method for creating an order as it does not
 * lock user funds and is not atomic.
 * Use createOrderWithBalanceLock instead.
 */
export const unsafeCreateOrder = async (data: OrderSchema, market: string): Promise<Order> => {
  // This function is left here to show the "before" state. Do not use it in production.
  throw new Error("This function is deprecated. Use createOrderWithBalanceLock.");
};

/**
 * Creates an order and atomically locks the required user funds in a single transaction.
 * This is the safe and correct way to create a new order.
 *
 * @param data The validated order data from the user.
 * @param marketSymbol The market symbol (e.g., "BTC_USDT").
 * @returns The newly created order.
 * @throws Error if the user has insufficient funds, market doesn't exist, or for other db errors.
 */
export const createOrderWithBalanceLock = async (data: OrderPayload, marketSymbol: string): Promise<Order> => {
  return db.$transaction(async (tx) => {
    // Step 1: Get market info to determine which asset to lock
    const market = await tx.market.findUniqueOrThrow({ where: { symbol: marketSymbol } });

    const price = new Prisma.Decimal(data.price || 0);
    const quantity = new Prisma.Decimal(data.quantity);

    const assetToLock = data.side === Side.Buy ? market.quoteAsset : market.baseAsset;
    const amountToLock = data.side === Side.Buy ? price.times(quantity) : quantity;
    const amountToLockBigInt = BigInt(amountToLock.toFixed(0)); // Use BigInt for balance model

    if (amountToLockBigInt <= 0) {
      throw new Error("Order amount must be positive.");
    }

    // Step 2: Atomically check for funds and lock them
    const balance = await tx.balance.findUniqueOrThrow({
      where: { userId_asset: { userId: data.userId, asset: assetToLock } },
    });

    if (balance.amount < amountToLockBigInt) {
      throw new Error(`Insufficient funds. User has ${balance.amount}, but needs ${amountToLockBigInt} of ${assetToLock}.`);
    }

    await tx.balance.update({
      where: { id: balance.id },
      data: {
        amount: { decrement: amountToLockBigInt },
        locked: { increment: amountToLockBigInt },
      },
    });

    // Step 3: Create the order record (only if funds were successfully locked)
    const newOrder = await tx.order.create({
      data: {
        userId: data.userId,
        market: marketSymbol,
        orderType: data.orderType,
        side: data.side,
        price: price,
        quantity: quantity,
        remaining: quantity,
        filled: 0,
        status: OrderStatus.Open,
        clientOrderId: data.clientOrderId,
      },
    });

    console.log(`[OrderService] Created order ${newOrder.id} and locked ${amountToLockBigInt} ${assetToLock}`);
    return newOrder;
  });
};

export const getOrderById = async (id: string): Promise<Order | null> => {
  return db.order.findUnique({ where: { id } });
};

export const getOrdersByUserId = async (userId: string): Promise<Order[]> => {
  return db.order.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
};

/**
 * Cancels an order and atomically unlocks the remaining user funds.
 * This is the safe and correct way to cancel an order.
 *
 * @param id The ID of the order to cancel.
 * @returns The updated order.
 * @throws Error if the order is already filled or doesn't exist.
 */
export const cancelOrderAndUnlockFunds = async (id: string): Promise<Order> => {
  return db.$transaction(async (tx) => {
    // Step 1: Find the order to be canceled
    const order = await tx.order.findUniqueOrThrow({ where: { id } });

    if (order.status !== OrderStatus.Open && order.status !== OrderStatus.PartiallyFilled) {
      throw new Error(`Cannot cancel order in status: ${order.status}`);
    }

    // Step 2: Determine which asset and how much to unlock
    const market = await tx.market.findUniqueOrThrow({ where: { symbol: order.market } });

    const assetToUnlock = order.side === Side.Buy ? market.quoteAsset : market.baseAsset;
    const amountToUnlock = order.side === Side.Buy ? order.price.times(order.remaining) : order.remaining;
    const amountToUnlockBigInt = BigInt(amountToUnlock.toFixed(0));

    // Step 3: Atomically unlock the funds
    if (amountToUnlockBigInt > 0) {
      await tx.balance.update({
        where: {
          userId_asset: {
            userId: order.userId,
            asset: assetToUnlock,
          },
        },
        data: {
          locked: { decrement: amountToUnlockBigInt },
          amount: { increment: amountToUnlockBigInt },
        },
      });
    }

    // Step 4: Update the order status
    const canceledOrder = await tx.order.update({
      where: { id },
      data: { status: OrderStatus.Canceled, canceledAt: new Date() },
    });

    console.log(`[OrderService] Canceled order ${canceledOrder.id} and unlocked ${amountToUnlockBigInt} ${assetToUnlock}`);
    return canceledOrder;
  });
};
