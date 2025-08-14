// src/workers/seeder.ts (or your original filename)

import { db } from "@/lib/db";
import type { RedisClientType } from "redis";
// import { orderSchema } from "@/schemas/orderSchema";
// IMPORTANT: Import the new transactional function
import { cancelOrderAndUnlockFunds, createOrderWithBalanceLock } from "@/services/orderService";
// We will need to create a transactional trade processor as well
import {
  processTradeInTransaction,
  type TradeMessage,
} from "@/services/tradeService"; // Assuming this file is created as per previous examples
import { orderSchema } from "@/middleware/validator";

/**
 * Worker to process NEW order requests from a queue.
 * It uses a reliable queue pattern and a transactional database update to lock funds.
 */
export const processNewOrdersWorker = async (client: RedisClientType) => {
  try {
    const markets = await db.market.findMany();
    for (const market of markets) {
      const mainQueue = `orders:new:${market.symbol}`;
      const processingQueue = `${mainQueue}:processing`;
      const deadLetterQueue = `${mainQueue}:dead-letter`;

      console.log(`[OrderWorker] Starting listener on ${mainQueue}`);

      while (true) {
        let orderJSON: string | null = null;
        try {
          // Reliable Queue Pattern: Atomically move message from main to processing queue
          orderJSON = await client.lMove(
            mainQueue,
            processingQueue,
            "LEFT",
            "RIGHT",
          );

          if (orderJSON) {
            const order = JSON.parse(orderJSON);
            console.log("[OrderWorker] Processing order:", order);
            const validation = orderSchema.safeParse(order);

            if (validation.success) {
              // Call the new, safe transactional function
              await createOrderWithBalanceLock(validation.data, market.symbol);

              // If successful, remove the message from the processing queue
              await client.lRem(processingQueue, -1, orderJSON);
            } else {
              console.error(
                "[OrderWorker] Invalid order schema:",
                validation.error,
              );
              throw new Error("Invalid order schema"); // Throw to move to dead-letter
            }
          }
        } catch (err: any) {
          console.error(
            `[OrderWorker] CRITICAL ERROR processing order: ${err?.message}`,
          );
          if (orderJSON) {
            // Move the poisonous message to a dead-letter queue for inspection
            await client.lMove(
              processingQueue,
              deadLetterQueue,
              "RIGHT",
              "LEFT",
            );
          }
          // Wait a moment to prevent fast-spinning on a persistent error
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    }
  } catch (err) {
    console.error("Error initializing the Orders Worker", err);
  }
};

/**
 * Worker to process FILLED trades from the matching engine.
 * It uses a reliable queue pattern and a transactional database update for all parties.
 */
export const processTradesWorker = async (client: RedisClientType) => {
  try {
    const markets = await db.market.findMany();
    for (const market of markets) {
      const mainQueue = `orderbook:trades:${market.symbol}`;
      const processingQueue = `${mainQueue}:processing`;
      const deadLetterQueue = `${mainQueue}:dead-letter`;

      console.log(`[TradeWorker] Starting listener on ${mainQueue}`);

      while (true) {
        let tradeJSON: string | null = null;
        try {
          // Reliable Queue Pattern
          tradeJSON = await client.blMove(
            mainQueue,
            processingQueue,
            "LEFT",
            "RIGHT",
            0,
          );

          if (tradeJSON) {
            const trade: TradeMessage = JSON.parse(tradeJSON);
            console.log("[TradeWorker] Processing trade:", trade.id);

            // Call your transactional trade processing function (you'll need to create this service)
            await processTradeInTransaction(trade);

            // Success! Remove from processing queue
            await client.lRem(processingQueue, -1, tradeJSON);
          }
        } catch (err: any) {
          console.error(
            `[TradeWorker] CRITICAL ERROR processing trade: ${err?.message}`,
          );
          if (tradeJSON) {
            // Move poisonous message to dead-letter queue
            await client.lMove(
              processingQueue,
              deadLetterQueue,
              "RIGHT",
              "LEFT",
            );
          }
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    }
  } catch (error) {
    console.error("Error initializing the Trades Worker", error);
  }
};

/**
 * Worker to process confirmed order cancellations from the matching engine.
 * It uses a reliable queue pattern to ensure that funds are unlocked only when a cancellation is confirmed.
 */
export const processCancellationsWorker = async (client: RedisClientType) => {
  try {
    const markets = await db.market.findMany();
    for (const market of markets) {
      const mainQueue = `engine:processed_cancellations:${market.symbol}`;
      const processingQueue = `${mainQueue}:processing`;
      const deadLetterQueue = `${mainQueue}:dead-letter`;

      console.log(`[CancellationWorker] Starting listener on ${mainQueue}`);

      while (true) {
        let cancellationJSON: string | null = null;
        try {
          cancellationJSON = await client.blMove(
            mainQueue,
            processingQueue,
            "LEFT",
            "RIGHT",
            0,
          );

          if (cancellationJSON) {
            const cancellationResult = JSON.parse(cancellationJSON);
            console.log("[CancellationWorker] Processing cancellation:", cancellationResult);

            if (cancellationResult.status === "SUCCESS") {
              await cancelOrderAndUnlockFunds(cancellationResult.orderId);
            }

            await client.lRem(processingQueue, -1, cancellationJSON);
          }
        } catch (err: any) {
          console.error(
            `[CancellationWorker] CRITICAL ERROR processing cancellation: ${err?.message}`,
          );
          if (cancellationJSON) {
            await client.lMove(
              processingQueue,
              deadLetterQueue,
              "RIGHT",
              "LEFT",
            );
          }
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    }
  } catch (error) {
    console.error("Error initializing the Cancellations Worker", error);
  }
};