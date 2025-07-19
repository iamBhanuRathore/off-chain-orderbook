import { db } from "@/lib/db";
import type { RedisClientType } from "redis";
import { orderSchema } from "@/schemas/orderSchema";
import { createOrder } from "@/services/orderService";

export const seedOrdersToDb = async (client: RedisClientType) => {
  try {
    const markets = await db.market.findMany();
    for (const market of markets) {
      const queueName = `engine:processed_orders:${market.symbol}`;
      // run an loop to get the orders from the queue and add them to the db
      while (true) {
        const result = await client.brPop(queueName, 0); // 0 means block indefinitely
        if (result) {
          const { key, element } = result;
          const order = JSON.parse(element);
          console.log("Processing order from queue:", order);
          const validation = orderSchema.safeParse(order);

          if (validation.success) {
            console.log("Order received from Redis:", validation.data);
            let res = await createOrder(validation.data, market.symbol);
            console.log("Order created in DB:", res);
          } else {
            console.error("Invalid order received from Redis:", validation.error);
          }
        }
      }
    }
  } catch (err) {
    console.error("Error seeding orders to DB", err);
  }
};

export const seedTradesToDb = async (client: RedisClientType) => {
  try {
    const markets = await db.market.findMany();
    for (const market of markets) {
      const queueName = `orderbook:trades:${market.symbol}`;
      // run an loop to get the trades from the queue and add them to the db
      while (true) {
        const result = await client.brPop(queueName, 0); // 0 means block indefinitely
        if (result) {
          const { key, element } = result;
          const trade = JSON.parse(element);
          console.log("Processing trade from queue:", trade);
          // Assuming a tradeSchema exists for validation
          // const validation = tradeSchema.safeParse(trade);

          // if (validation.success) {
          //   await createTrade(validation.data);
          // } else {
          //   console.error("Invalid trade received from Redis:", validation.error);
          // }
          // Temporarily adding trade without validation
          await db.trade.create({
            data: {
              market: trade.market,
              price: trade.price,
              quantity: trade.quantity,
              takerSide: trade.taker_side,
              buyOrderId: trade.buy_order_id,
              sellOrderId: trade.sell_order_id,
              buyerId: trade.buyer_id,
              sellerId: trade.seller_id,
              fee: trade.fee,
              feeAsset: trade.fee_asset,
              timestamp: trade.timestamp,
            },
          });
        }
      }
    }
  } catch (error) {
    console.error("Error seeding trades to DB:", error);
  }
};
