import { db } from "@/lib/db";
import type { RedisClientType } from "redis";

export const seedOrdersToDb = async (client: RedisClientType) => {
  try {
    const markets = await db.market.findMany();
    console.log("Markets:", markets);
    for (const market of markets) {
      const queueName = `engine:processed_orders:${market.symbol}`;
      // run an loop to get the orders from the queue and add them to the db
      while (true) {
        const result = await client.brPop(queueName, 0); // 0 means block indefinitely
        if (result) {
          const { key, element } = result;
          const order = JSON.parse(element);
          console.log("Processing order from queue:", order);
          // Here you would typically call a service to save the order to your database
          // For example: await saveOrderToDatabase(order);
        }
      }
    }
  } catch {}
};
