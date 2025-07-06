// src/services/redisService.ts
import type { OrderbookLevel } from "@/types";
import { Redis } from "ioredis";

const redisConfig = {
  host: "127.0.0.1",
  port: 6379,
  maxRetriesPerRequest: 3,
  retryStrategy(times: number) {
    if (times > 20) return null;
    return Math.min(times * 50, 2000); // Exponential backoff
  },
};

class RedisService {
  public publisher: Redis;
  public subscriber: Redis;

  constructor() {
    this.publisher = new Redis(redisConfig);
    this.subscriber = new Redis(redisConfig);

    this.publisher.on("error", (err) => console.error("Redis Publisher Error", err));
    this.subscriber.on("error", (err) => console.error("Redis Subscriber Error", err));
  }

  // --- Publishing Methods ---
  async publishNewOrder(symbol: string, order: Omit<any, "symbol">) {
    const command = { command: "NewOrder", payload: order };
    const queueKey = `orderbook:orders:${symbol.replace("/", "_")}`;
    await this.publisher.lpush(queueKey, JSON.stringify(command));
  }

  async publishCancelOrder(symbol: string, cancelData: { order_id: string }) {
    const command = { command: "CancelOrder", payload: cancelData };
    const queueKey = `orderbook:cancel:${symbol.replace("/", "_")}`;
    await this.publisher.lpush(queueKey, JSON.stringify(command));
  }

  async requestSnapshot(symbol: string, responseChannel: string) {
    const request = { command: "SnapshotRequest", payload: { response_channel: responseChannel } };
    const queueKey = `orderbook:snapshot:${symbol.replace("/", "_")}:requests`;
    await this.publisher.lpush(queueKey, JSON.stringify(request));
  }

  // --- Data Fetching Methods ---
  async getOrderbook(symbol: string, limit: number = 10) {
    const symbolKey = symbol.replace("/", "_");
    const bidsKey = `orderbook:bids:${symbolKey}`;
    const asksKey = `orderbook:asks:${symbolKey}`;
    const ltpKey = `orderbook:ltp:${symbolKey}`;

    const parseLevels = (data: string[]): OrderbookLevel[] => {
      const levels: OrderbookLevel[] = [];
      for (let i = 0; i < data.length; i += 2) {
        const [price, quantity] = (data[i] || "").split(":");
        if (price && quantity) {
          levels.push({ price: parseFloat(price), quantity: parseFloat(quantity) });
        }
      }
      return levels;
    };

    const [bidsData, asksData, ltp] = await Promise.all([
      this.publisher.zrevrange(bidsKey, 0, limit - 1, "WITHSCORES"),
      this.publisher.zrange(asksKey, 0, limit - 1, "WITHSCORES"),
      this.publisher.get(ltpKey),
    ]);

    return {
      bids: parseLevels(bidsData),
      asks: parseLevels(asksData),
      last_traded_price: ltp ? parseFloat(ltp) : null,
    };
  }

  // --- Pub/Sub Management ---
  subscribe(channels: string[], onMessage: (channel: string, message: string) => void) {
    if (channels.length > 0) {
      this.subscriber.subscribe(...channels);
      this.subscriber.on("message", onMessage);
      console.log(`Subscribed to Redis channels: ${channels.join(", ")}`);
    }
  }

  async shutdown() {
    await this.publisher.quit();
    await this.subscriber.quit();
  }
}

export const redisService = new RedisService();
