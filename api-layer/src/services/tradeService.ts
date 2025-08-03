// src/services/tradeService.ts
import { db } from "../lib/db";
import {
  Prisma,
  Side,
  OrderStatus,
  type Trade,
} from "../generated/prisma/client";

// Message from matching engine
export type TradeMessage = {
  id: string; // Unique trade ID from matching engine
  market: string;
  price: string;
  quantity: string;
  makerOrderId: string;
  takerOrderId: string;
  timestamp: number; // Unix timestamp ms
};

/**
 * Processes a trade from the matching engine within a single database transaction.
 * This function is the source of truth for trade settlement. It ensures that all
 * balance changes, order status updates, and the trade record creation are atomic.
 *
 * @param trade The trade message from the matching engine queue.
 * @returns The newly created trade record.
 * @throws Error on any failure, ensuring the transaction is rolled back.
 */
export const processTradeInTransaction = async (
  trade: TradeMessage,
): Promise<Trade> => {
  return db.$transaction(async (tx) => {
    const price = new Prisma.Decimal(trade.price);
    const quantity = new Prisma.Decimal(trade.quantity);
    const tradeValue = price.times(quantity);

    if (quantity.isZero() || quantity.isNegative()) {
      throw new Error("Trade quantity must be positive.");
    }

    // 1. Fetch orders and lock them for update.
    const makerOrder = await tx.order.findUniqueOrThrow({
      where: { id: trade.makerOrderId },
    });
    const takerOrder = await tx.order.findUniqueOrThrow({
      where: { id: trade.takerOrderId },
    });

    // 2. Identify buyer, seller, and market details.
    const buyOrder = makerOrder.side === Side.Buy ? makerOrder : takerOrder;
    const sellOrder = makerOrder.side === Side.Sell ? makerOrder : takerOrder;
    const buyerId = buyOrder.userId;
    const sellerId = sellOrder.userId;

    const market = await tx.market.findUniqueOrThrow({
      where: { symbol: trade.market },
    });
    const { baseAsset, quoteAsset } = market;

    // 3. Update balances atomically.

    // ---- Seller's balance update ----
    // Seller gives `quantity` of `baseAsset` (from locked) and receives `tradeValue` of `quoteAsset` (to available).
    await tx.balance.update({
      where: { userId_asset: { userId: sellerId, asset: baseAsset } },
      data: { locked: { decrement: BigInt(quantity.toFixed(0)) } },
    });
    await tx.balance.update({
      where: { userId_asset: { userId: sellerId, asset: quoteAsset } },
      data: { amount: { increment: BigInt(tradeValue.toFixed(0)) } },
    });

    // ---- Buyer's balance update ----
    // Buyer receives `quantity` of `baseAsset` (to available).
    await tx.balance.update({
      where: { userId_asset: { userId: buyerId, asset: baseAsset } },
      data: { amount: { increment: BigInt(quantity.toFixed(0)) } },
    });

    // Buyer gives `tradeValue` of `quoteAsset`. The amount was locked based on their limit price.
    // Any difference between the locked amount and the actual trade value is refunded.
    const amountLockedForTrade = buyOrder.price.times(quantity);
    const refund = amountLockedForTrade.minus(tradeValue);

    if (refund.isNegative()) {
      // This should be prevented by the matching engine logic.
      throw new Error(
        `Critical Error: Buyer ${buyerId} would pay ${tradeValue} which is more than their limit price of ${buyOrder.price} for quantity ${quantity}.`,
      );
    }

    await tx.balance.update({
      where: { userId_asset: { userId: buyerId, asset: quoteAsset } },
      data: {
        locked: { decrement: BigInt(amountLockedForTrade.toFixed(0)) },
        amount: { increment: BigInt(refund.toFixed(0)) },
      },
    });

    // 4. Update order statuses.
    for (const order of [makerOrder, takerOrder]) {
      const newRemaining = order.remaining.minus(quantity);
      const newFilled = order.filled.plus(quantity);
      const newStatus = newRemaining.isZero()
        ? OrderStatus.Filled
        : OrderStatus.PartiallyFilled;

      if (newRemaining.isNegative()) {
        throw new Error(
          `Critical Error: Order ${order.id} would be overfilled.`,
        );
      }

      await tx.order.update({
        where: { id: order.id },
        data: {
          remaining: newRemaining,
          filled: newFilled,
          status: newStatus,
          updatedAt: new Date(),
        },
      });
    }

    // 5. Create the trade record.
    const newTrade = await tx.trade.create({
      data: {
        id: trade.id,
        market: trade.market,
        price,
        quantity,
        takerSide: takerOrder.side, // The side of the order that crossed the book
        buyOrderId: buyOrder.id,
        sellOrderId: sellOrder.id,
        buyerId,
        sellerId,
        fee: BigInt(0), // Placeholder fee
        feeAsset: quoteAsset, // Placeholder fee asset
        timestamp: new Date(trade.timestamp),
      },
    });

    console.log(
      `[TradeService] Processed trade ${newTrade.id} for ${quantity} ${baseAsset} @ ${price} ${quoteAsset}`,
    );
    return newTrade;
  });
};

export const createTrade = async (
  data: Omit<
    Trade,
    "id" | "timestamp" | "buyOrder" | "sellOrder" | "buyer" | "seller"
  >,
): Promise<Trade> => {
  return db.trade.create({
    data,
  });
};

export const getTradesByMarket = async (market: string): Promise<Trade[]> => {
  return db.trade.findMany({
    where: { market },
    orderBy: { timestamp: "desc" },
    take: 100,
  });
};
