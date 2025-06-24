// server.ts
import express from "express";
import cors from "cors";
import { randomUUID } from "crypto";
import { Redis } from "ioredis";
import { readFileSync } from "fs";
import path, { join } from "path";
import type { ServerWebSocket } from "bun";

interface TradingPair {
  symbol: string;
  base_asset: string;
  quote_asset: string;
  enabled: boolean;
  description: string;
}

interface OrderData {
  symbol: string;
  user_id: string;
  order_type: string;
  side: string;
  price?: string;
  quantity: string;
}

interface CancelOrderData {
  symbol: string;
  order_id: string;
}

interface SubscriptionData {
  symbol: string;
}

interface SnapshotData {
  symbol: string;
}

interface RedisOrderbookData {
  symbol: string;
  limit?: number;
}

interface WebSocketMessage {
  type: string;
  data: any;
}

interface OrderbookLevel {
  price: number;
  quantity: number;
  score: number;
}

class TradingWebSocketServer {
  private app: express.Application;
  private server: any;
  private redisPublisher: Redis;
  private redisSubscriber: Redis;
  private userSubscriptions: Map<string, Set<string>> = new Map();
  private channelSubscribers: Map<string, Set<string>> = new Map();
  private websockets: Map<string, ServerWebSocket<any>> = new Map();
  private tradingPairs: TradingPair[];

  constructor() {
    this.app = express();

    // Redis connections
    this.redisPublisher = new Redis({
      host: "127.0.0.1",
      port: 6379,

      retryStrategy(times) {
        // times: the number of retries already attempted
        // Return null to stop retrying, or a number (ms) to wait for the next retry.
        // For a fixed 100ms delay, and to stop after, e.g., 20 attempts:
        if (times > 20) {
          return null;
        }
        return 100; // Wait 100ms before next retry
      },
      maxRetriesPerRequest: 3,
    });

    this.redisSubscriber = new Redis({
      host: "127.0.0.1",
      port: 6379,
      retryStrategy(times) {
        // times: the number of retries already attempted
        // Return null to stop retrying, or a number (ms) to wait for the next retry.
        // For a fixed 100ms delay, and to stop after, e.g., 20 attempts:
        if (times > 20) {
          return null;
        }
        return 100; // Wait 100ms before next retry
      },
      maxRetriesPerRequest: 3,
    });

    this.tradingPairs = this.loadTradingPairs();
    this.setupMiddleware();
    this.setupRedisSubscriptions();
  }

  private loadTradingPairs(): TradingPair[] {
    const rawPairs = readFileSync(path.resolve(__dirname, "../../markets.json"), "utf-8");
    const pairs = JSON.parse(rawPairs);
    return pairs.filter((pair: TradingPair) => pair.enabled);
  }

  private setupMiddleware(): void {
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(express.static("public"));

    // Health check endpoint
    this.app.get("/health", (req, res) => {
      res.json({
        status: "ok",
        timestamp: new Date().toISOString(),
        connectedClients: this.websockets.size,
      });
    });

    // Get available trading pairs
    this.app.get("/api/pairs", (req, res) => {
      res.json(this.tradingPairs);
    });
  }

  private handleWebSocketMessage(ws: any, message: string): void {
    try {
      const parsedMessage: WebSocketMessage = JSON.parse(message);
      const { type, data } = parsedMessage;

      switch (type) {
        case "place_order":
          this.handlePlaceOrder(ws, data as OrderData);
          break;
        case "cancel_order":
          this.handleCancelOrder(ws, data as CancelOrderData);
          break;
        case "subscribe_orderbook":
          this.handleOrderbookSubscription(ws, data as SubscriptionData);
          break;
        case "unsubscribe_orderbook":
          this.handleOrderbookUnsubscription(ws, data as SubscriptionData);
          break;
        case "request_snapshot":
          this.handleSnapshotRequest(ws, data as SnapshotData);
          break;
        case "get_redis_orderbook":
          this.handleGetRedisOrderbook(ws, data as RedisOrderbookData);
          break;
        default:
          this.sendError(ws, "unknown_message_type", `Unknown message type: ${type}`);
      }
    } catch (error) {
      console.error("Error handling WebSocket message:", error);
      this.sendError(ws, "message_parse_error", "Failed to parse message");
    }
  }

  private sendMessage(ws: any, type: string, data: any): void {
    try {
      ws.send(
        JSON.stringify({
          type,
          data: {
            ...data,
            timestamp: new Date().toISOString(),
          },
        })
      );
    } catch (error) {
      console.error("Error sending WebSocket message:", error);
    }
  }

  private sendError(ws: any, errorType: string, message: string): void {
    this.sendMessage(ws, "error", {
      type: errorType,
      message,
    });
  }

  private async handlePlaceOrder(ws: any, data: OrderData): Promise<void> {
    try {
      let { symbol, user_id, order_type, side, price, quantity } = data;
      if (!symbol || !user_id || !order_type || !side || !quantity) {
        throw new Error("Missing required order parameters");
      }

      if (!this.tradingPairs.find((pair) => pair.symbol === symbol)) {
        throw new Error(`Invalid trading pair: ${symbol}`);
      }
      symbol = symbol.split("/").join("_");

      const order = {
        command: "NewOrder",
        payload: {
          user_id: parseInt(user_id),
          order_type,
          side,
          price: price || "0",
          quantity: quantity.toString(),
        },
      };

      const queueKey = `orderbook:orders:${symbol}`;
      await this.redisPublisher.lpush(queueKey, JSON.stringify(order));

      this.sendMessage(ws, "order_submitted", {
        symbol,
        order_type,
        side,
        price,
        quantity,
      });

      console.log(`Order placed for ${symbol}: ${side} ${quantity} @ ${price}`);
    } catch (error) {
      this.sendError(ws, "order_error", (error as Error).message);
    }
  }

  private async handleCancelOrder(ws: any, data: CancelOrderData): Promise<void> {
    try {
      let { symbol, order_id } = data;

      if (!symbol || !order_id) {
        throw new Error("Missing symbol or order_id");
      }

      if (!this.tradingPairs.find((pair) => pair.symbol === symbol)) {
        throw new Error(`Invalid trading pair: ${symbol}`);
      }
      symbol = symbol.split("/").join("_");
      const cancelCommand = {
        command: "CancelOrder",
        payload: {
          order_id,
        },
      };

      const queueKey = `orderbook:cancel:${symbol}`;
      await this.redisPublisher.lpush(queueKey, JSON.stringify(cancelCommand));

      this.sendMessage(ws, "cancel_submitted", {
        symbol,
        order_id,
      });

      console.log(`Cancel order submitted for ${symbol}: ${order_id}`);
    } catch (error) {
      this.sendError(ws, "cancel_error", (error as Error).message);
    }
  }

  private handleOrderbookSubscription(ws: any, data: SubscriptionData): void {
    try {
      let { symbol } = data;
      if (!symbol) {
        throw new Error("Symbol is required for subscription");
      }

      if (!this.tradingPairs.find((pair) => pair.symbol === symbol)) {
        throw new Error(`Invalid trading pair: ${symbol}`);
      }
      symbol = symbol.split("/").join("_");
      const deltaChannel = `orderbook:deltas:${symbol}`;
      const tradeChannel = `orderbook:trades:${symbol}`;

      // Add to user subscriptions
      const userSubs = this.userSubscriptions.get(ws.id) || new Set();
      userSubs.add(deltaChannel);
      userSubs.add(tradeChannel);
      this.userSubscriptions.set(ws.id, userSubs);

      // Add to channel subscribers
      if (!this.channelSubscribers.has(deltaChannel)) {
        this.channelSubscribers.set(deltaChannel, new Set());
      }
      if (!this.channelSubscribers.has(tradeChannel)) {
        this.channelSubscribers.set(tradeChannel, new Set());
      }

      this.channelSubscribers.get(deltaChannel)!.add(ws.id);
      this.channelSubscribers.get(tradeChannel)!.add(ws.id);

      this.sendMessage(ws, "subscribed", {
        symbol,
        channels: [deltaChannel, tradeChannel],
      });

      console.log(`Client ${ws.id} subscribed to ${symbol} orderbook`);
    } catch (error) {
      this.sendError(ws, "subscription_error", (error as Error).message);
    }
  }

  private handleOrderbookUnsubscription(ws: any, data: SubscriptionData): void {
    try {
      let { symbol } = data;

      if (!symbol) {
        throw new Error("Symbol is required for unsubscription");
      }
      symbol = symbol.split("/").join("_");
      const deltaChannel = `orderbook:deltas:${symbol}`;
      const tradeChannel = `orderbook:trades:${symbol}`;

      // Remove from user subscriptions
      const userSubs = this.userSubscriptions.get(ws.id);
      if (userSubs) {
        userSubs.delete(deltaChannel);
        userSubs.delete(tradeChannel);
      }

      // Remove from channel subscribers
      if (this.channelSubscribers.has(deltaChannel)) {
        this.channelSubscribers.get(deltaChannel)!.delete(ws.id);
      }
      if (this.channelSubscribers.has(tradeChannel)) {
        this.channelSubscribers.get(tradeChannel)!.delete(ws.id);
      }

      this.sendMessage(ws, "unsubscribed", { symbol });

      console.log(`Client ${ws.id} unsubscribed from ${symbol} orderbook`);
    } catch (error) {
      this.sendError(ws, "unsubscription_error", (error as Error).message);
    }
  }

  private async handleSnapshotRequest(ws: any, data: SnapshotData): Promise<void> {
    try {
      let { symbol } = data;
      if (!symbol) {
        throw new Error("Symbol is required for snapshot");
      }

      if (!this.tradingPairs.find((pair) => pair.symbol === symbol)) {
        throw new Error(`Invalid trading pair: ${symbol}`);
      }
      // this symbol our matching engine supports
      symbol = symbol.split("/").join("_");

      const responseChannel = `snapshot_${ws.id}_${Date.now()}`;

      // Subscribe to response channel temporarily
      const tempSubscriber = new Redis({
        host: "127.0.0.1",
        port: 6379,
      });

      await tempSubscriber.subscribe(responseChannel);
      // to remove the connection if the matching engine does not give response
      let timeout = setTimeout(async () => {
        await tempSubscriber.unsubscribe(responseChannel);
        tempSubscriber.disconnect();
        this.sendError(ws, "snapshot_timeout", "Snapshot request timed out");
      }, 3 * 1000);
      tempSubscriber.on("message", async (channel: string, message: string) => {
        if (channel === responseChannel) {
          try {
            const snapshot = JSON.parse(message);
            this.sendMessage(ws, "orderbook_snapshot", {
              symbol,
              snapshot,
            });
          } catch (error) {
            this.sendError(ws, "snapshot_parse_error", "Failed to parse snapshot data");
          }
          clearTimeout(timeout);
          await tempSubscriber.unsubscribe(responseChannel);
          tempSubscriber.disconnect();
        }
      });

      // Request snapshot
      const snapshotRequest = {
        command: "SnapshotRequest",
        payload: {
          response_channel: responseChannel,
        },
      };
      const queueKey = `orderbook:snapshot:${symbol}:requests`;
      await this.redisPublisher.lpush(queueKey, JSON.stringify(snapshotRequest));

      console.log(`Snapshot requested for ${symbol} by client ${ws.id}`);
    } catch (error) {
      this.sendError(ws, "snapshot_error", (error as Error).message);
    }
  }

  private async handleGetRedisOrderbook(ws: any, data: RedisOrderbookData): Promise<void> {
    try {
      let { symbol, limit = 10 } = data;

      if (!symbol) {
        throw new Error("Symbol is required");
      }

      if (!this.tradingPairs.find((pair) => pair.symbol === symbol)) {
        throw new Error(`Invalid trading pair: ${symbol}`);
      }
      symbol = symbol.split("/").join("_");
      const bidsKey = `orderbook:bids:${symbol}`;
      const asksKey = `orderbook:asks:${symbol}`;
      const ltpKey = `orderbook:ltp:${symbol}`;

      // Get bids (highest first)
      const bidsData = await this.redisPublisher.zrevrange(bidsKey, 0, limit - 1, "WITHSCORES");
      console.log(bidsData);
      const bids: OrderbookLevel[] = [];
      for (let i = 0; i < bidsData.length; i += 2) {
        if (typeof bidsData[i] === "string") {
          // @ts-ignore
          const [price, quantity] = bidsData[i].split(":");
          if (price && quantity) {
            bids.push({
              price: parseFloat(price),
              quantity: parseFloat(quantity),
              score: parseFloat(bidsData[i + 1] as string),
            });
          }
        }
      }

      // Get asks (lowest first)
      const asksData = await this.redisPublisher.zrange(asksKey, 0, limit - 1, "WITHSCORES");
      console.log(asksData);
      const asks: OrderbookLevel[] = [];
      for (let i = 0; i < asksData.length; i += 2) {
        if (typeof asksData[i] === "string") {
          // @ts-ignore
          const [price = "", quantity = ""] = asksData[i].split(":");
          if (price && quantity) {
            asks.push({
              price: parseFloat(price),
              quantity: parseFloat(quantity),
              score: parseFloat(asksData[i + 1] as string),
            });
          }
        }
      }

      // Get last traded price
      const ltp = await this.redisPublisher.get(ltpKey);

      this.sendMessage(ws, "redis_orderbook", {
        symbol,
        bids,
        asks,
        last_traded_price: ltp ? parseFloat(ltp) : null,
      });
    } catch (error) {
      this.sendError(ws, "redis_orderbook_error", `Failed to fetch Redis orderbook: ${(error as Error).message}`);
    }
  }

  private setupRedisSubscriptions(): void {
    // Subscribe to all delta and trade channels for enabled trading pairs
    const channels: string[] = [];
    this.tradingPairs.forEach((pair) => {
      channels.push(`orderbook:deltas:${pair.base_asset}_${pair.quote_asset}`);
      channels.push(`orderbook:trades:${pair.base_asset}_${pair.quote_asset}`);
    });

    if (channels.length > 0) {
      this.redisSubscriber.subscribe(...channels);
      console.log(`Subscribed to Redis channels: ${channels.join(", ")}`);
    }

    this.redisSubscriber.on("message", (channel: string, message: string) => {
      try {
        if (this.channelSubscribers.has(channel)) {
          const subscribers = this.channelSubscribers.get(channel)!;
          const data = JSON.parse(message);

          let eventType: string;
          if (channel.includes("deltas")) {
            eventType = "orderbook_delta";
          } else if (channel.includes("trades")) {
            eventType = "trade";
          } else {
            return;
          }

          subscribers.forEach((wsId) => {
            const ws = this.websockets.get(wsId);
            if (ws && ws.readyState === 1) {
              // WebSocket.OPEN
              this.sendMessage(ws, eventType, {
                channel,
                data,
              });
            }
          });
        }
      } catch (error) {
        console.error(`Error processing Redis message from ${channel}:`, error);
      }
    });

    this.redisSubscriber.on("error", (error: Error) => {
      console.error("Redis subscriber error:", error);
    });
  }

  private cleanupUserSubscriptions(wsId: string): void {
    // Remove from channel subscribers
    const userSubs = this.userSubscriptions.get(wsId);
    if (userSubs) {
      userSubs.forEach((channel) => {
        if (this.channelSubscribers.has(channel)) {
          this.channelSubscribers.get(channel)!.delete(wsId);

          // Clean up empty channel subscriber sets
          if (this.channelSubscribers.get(channel)!.size === 0) {
            this.channelSubscribers.delete(channel);
          }
        }
      });
    }

    this.userSubscriptions.delete(wsId);
    this.websockets.delete(wsId);
  }

  public start(port: number = 3000): void {
    this.server = Bun.serve({
      port,
      fetch: (req, server) => {
        const url = new URL(req.url);

        // Handle WebSocket upgrade
        if (server.upgrade(req)) {
          return; // Upgraded to WebSocket
        }

        // Handle HTTP requests with Express
        return new Promise((resolve) => {
          const res = {
            statusCode: 200,
            headers: new Headers(),
            json: (data: any) => {
              res.headers.set("Content-Type", "application/json");
              resolve(
                new Response(JSON.stringify(data), {
                  status: res.statusCode,
                  headers: res.headers,
                })
              );
            },
            status: (code: number) => {
              res.statusCode = code;
              return res;
            },
            setHeader: (name: string, value: string) => {
              res.headers.set(name, value);
            },
          };

          const mockReq = {
            url: url.pathname + url.search,
            method: req.method,
            headers: Object.fromEntries(req.headers.entries()),
          };

          if (url.pathname === "/health") {
            res.json({
              status: "ok",
              timestamp: new Date().toISOString(),
              connectedClients: this.websockets.size,
            });
          } else if (url.pathname === "/api/pairs") {
            res.json(this.tradingPairs);
          } else {
            resolve(new Response("Not Found", { status: 404 }));
          }
        });
      },
      websocket: {
        open: (ws) => {
          const wsId = randomUUID();
          (ws as any).id = wsId;
          this.websockets.set(wsId, ws);
          this.userSubscriptions.set(wsId, new Set());

          console.log(`Client connected: ${wsId}`);

          // Send available trading pairs on connection
          this.sendMessage(ws, "trading_pairs", this.tradingPairs);
        },
        message: (ws, message) => {
          this.handleWebSocketMessage(ws, message.toString());
        },
        close: (ws) => {
          const wsId = (ws as any).id;
          console.log(`Client disconnected: ${wsId}`);
          this.cleanupUserSubscriptions(wsId);
        },
        // error: (ws, error) => {
        //   const wsId = (ws as any).id;
        //   console.error(`WebSocket error for client ${wsId}:`, error);
        // },
      },
    });

    console.log(`Trading WebSocket Server running on port ${port}`);
    console.log(`Available trading pairs: ${this.tradingPairs.map((p) => p.symbol).join(", ")}`);
  }

  public async shutdown(): Promise<void> {
    console.log("Shutting down server...");
    await this.redisPublisher.quit();
    await this.redisSubscriber.quit();
    if (this.server) {
      this.server.stop();
    }
  }
}

// Initialize and start server
const server = new TradingWebSocketServer();
server.start(4000);
// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("\nReceived SIGINT, shutting down gracefully...");
  await server.shutdown();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\nReceived SIGTERM, shutting down gracefully...");
  await server.shutdown();
  process.exit(0);
});

export default TradingWebSocketServer;

let a = {
  symbol: "BTC/INR",
  bids: [
    { price: "50030", quantity: "5" },
    { price: "50005", quantity: "20" },
    { price: "50000", quantity: "20" },
  ],
  asks: [
    { price: "50100", quantity: "15" },
    { price: "50200", quantity: "20" },
  ],
  last_traded_price: "50100",
  timestamp: "2025-06-17T20:53:03.197055Z",
};
