import { redisManager } from "../services/redis";
import * as orderService from "../services/orderService";
import * as tradeService from "../services/tradeService";
import markets from "../../markets.json";
import { OrderPayload } from "@/middleware/validator";
import { TradeMessage } from "@/services/tradeService";

const redisClient = redisManager.getClient();

const processOrder = async (order: OrderPayload) => {
  try {
    console.log(`[DBWorker] Processing order: ${order.clientOrderId}`);
    // This assumes the payload from the engine matches what createOrderWithBalanceLock expects.
    // The engine should be providing the full original order payload.
    await orderService.createOrderWithBalanceLock(order, order.symbol);
    console.log(`[DBWorker] Successfully processed order: ${order.clientOrderId}`);
  } catch (error) {
    console.error(`[DBWorker] Error processing order ${order.clientOrderId}:`, error);
  }
};

const processTrade = async (trade: TradeMessage) => {
  try {
    console.log(`[DBWorker] Processing trade: ${trade.id}`);
    await tradeService.processTradeInTransaction(trade);
    console.log(`[DBWorker] Successfully processed trade: ${trade.id}`);
  } catch (error) {
    console.error(`[DBWorker] Error processing trade ${trade.id}:`, error);
  }
};

const start = async () => {
  console.log("[DBWorker] Starting...");
  const orderQueues = markets
    .filter((m) => m.enabled)
    .map((m) => `engine:processed_orders:${m.base_asset}_${m.quote_asset}`);

  const tradeQueues = markets
    .filter((m) => m.enabled)
    .map((m) => `engine:processed_trades:${m.base_asset}_${m.quote_asset}`);

  const allQueues = [...orderQueues, ...tradeQueues];

  console.log("[DBWorker] Listening on queues:", allQueues);

  while (true) {
    try {
      const result = await redisClient.brPop(allQueues, 0);
      if (result) {
        const { key: queueName, element: message } = result;
        const data = JSON.parse(message);

        if (queueName.includes("processed_orders")) {
          await processOrder(data.payload as OrderPayload);
        } else if (queueName.includes("processed_trades")) {
          await processTrade(data.payload as TradeMessage);
        }
      }
    } catch (error) {
      console.error("[DBWorker] Error listening to Redis queues:", error);
      // Wait for a bit before retrying to prevent a tight loop on connection errors
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
};

export const dbWorker = {
  start,
};
