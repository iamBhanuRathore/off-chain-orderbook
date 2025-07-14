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

interface AuthenticatedWebSocket extends ServerWebSocket<any> {
  id: string;
  user_id: string;
  isAuthenticated: boolean;
}

class TradingWebSocketServer {
  private app: express.Application;
  private server: any;
  private redisPublisher: Redis;
  private redisSubscriber: Redis;
  private userSubscriptions: Map<string, Set<string>> = new Map();
  private channelSubscribers: Map<string, Set<string>> = new Map();
  private websockets: Map<string, AuthenticatedWebSocket> = new Map();
  private tradingPairs: TradingPair[];

  constructor() {
    this.app = express();

    // Redis connections
    this.redisPublisher = new Redis({
      host: "127.0.0.1",
      port: 6379,
      retryStrategy(times) {
        if (times > 20) {
          return null;
        }
        return 100;
      },
      maxRetriesPerRequest: 3,
    });

    this.redisSubscriber = new Redis({
      host: "127.0.0.1",
      port: 6379,
      retryStrategy(times) {
        if (times > 20) {
          return null;
        }
        return 100;
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

  private validateUserId(userId: string): boolean {
    // TODO: Add your user validation logic here
    if (!userId || typeof userId !== "string" || userId.trim().length === 0) {
      return false;
    }

    // Example: Check if user ID is alphanumeric and has minimum length
    const userIdRegex = /^[a-zA-Z0-9_-]{3,50}$/;
    return userIdRegex.test(userId.trim());
  }

  private async authenticateUser(userId: string): Promise<boolean> {
    // Add your authentication logic here
    // This could involve checking against a database, cache, etc.

    try {
      // Example: Check if user exists in Redis
      // const userExists = await this.redisPublisher.exists(`user:${user_id}`);
      return true;
    } catch (error) {
      console.error("Error authenticating user:", error);
      return false;
    }
  }

  private extractUserIdFromUrl(url: string): string | null {
    try {
      const urlObj = new URL(url);
      return urlObj.searchParams.get("user_id");
    } catch {
      return null;
    }
  }

  private handleWebSocketMessage(ws: AuthenticatedWebSocket, message: string): void {
    // Check if user is authenticated before processing any message
    if (!ws.isAuthenticated) {
      this.sendError(ws, "authentication_required", "User must be authenticated to perform this action");
      return;
    }

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

  private sendMessage(ws: AuthenticatedWebSocket, type: string, data: any): void {
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

  private sendError(ws: AuthenticatedWebSocket, errorType: string, message: string): void {
    this.sendMessage(ws, "error", {
      type: errorType,
      message,
    });
  }

  private async handlePlaceOrder(ws: AuthenticatedWebSocket, data: OrderData): Promise<void> {
    try {
      let { symbol, order_type, side, price, quantity } = data;

      // Use the authenticated user ID instead of the one from data
      const user_id = ws.user_id;

      if (!symbol || !order_type || !side || !quantity) {
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
      console.log({ order });
      console.log({ queueKey });
      await this.redisPublisher.lpush(queueKey, JSON.stringify(order));

      this.sendMessage(ws, "order_submitted", {
        symbol,
        order_type,
        side,
        price,
        quantity,
        user_id,
      });
      console.log(`Order placed for ${symbol} by user ${user_id}: ${side} ${quantity} @ ${price}`);
    } catch (error) {
      this.sendError(ws, "order_error", (error as Error).message);
    }
  }

  private async handleCancelOrder(ws: AuthenticatedWebSocket, data: CancelOrderData): Promise<void> {
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
          user_id: ws.user_id, // Include user ID for verification
        },
      };

      const queueKey = `orderbook:cancel:${symbol}`;
      await this.redisPublisher.lpush(queueKey, JSON.stringify(cancelCommand));

      this.sendMessage(ws, "cancel_submitted", {
        symbol,
        order_id,
        user_id: ws.user_id,
      });

      console.log(`Cancel order submitted for ${symbol} by user ${ws.user_id}: ${order_id}`);
    } catch (error) {
      this.sendError(ws, "cancel_error", (error as Error).message);
    }
  }

  private handleOrderbookSubscription(ws: AuthenticatedWebSocket, data: SubscriptionData): void {
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
        user_id: ws.user_id,
      });

      console.log(`Client ${ws.id} (user: ${ws.user_id}) subscribed to ${symbol} orderbook`);
    } catch (error) {
      this.sendError(ws, "subscription_error", (error as Error).message);
    }
  }

  private handleOrderbookUnsubscription(ws: AuthenticatedWebSocket, data: SubscriptionData): void {
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

      this.sendMessage(ws, "unsubscribed", {
        symbol,
        user_id: ws.user_id,
      });

      console.log(`Client ${ws.id} (user: ${ws.user_id}) unsubscribed from ${symbol} orderbook`);
    } catch (error) {
      this.sendError(ws, "unsubscription_error", (error as Error).message);
    }
  }

  private async handleSnapshotRequest(ws: AuthenticatedWebSocket, data: SnapshotData): Promise<void> {
    try {
      let { symbol } = data;
      if (!symbol) {
        throw new Error("Symbol is required for snapshot");
      }

      if (!this.tradingPairs.find((pair) => pair.symbol === symbol)) {
        throw new Error(`Invalid trading pair: ${symbol}`);
      }
      symbol = symbol.split("/").join("_");

      const responseChannel = `snapshot_${ws.id}_${Date.now()}`;

      // Subscribe to response channel temporarily
      const tempSubscriber = new Redis({
        host: "127.0.0.1",
        port: 6379,
      });

      await tempSubscriber.subscribe(responseChannel);
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
              user_id: ws.user_id,
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
          user_id: ws.user_id,
        },
      };
      const queueKey = `orderbook:snapshot:${symbol}:requests`;
      await this.redisPublisher.lpush(queueKey, JSON.stringify(snapshotRequest));

      console.log(`Snapshot requested for ${symbol} by user ${ws.user_id}`);
    } catch (error) {
      this.sendError(ws, "snapshot_error", (error as Error).message);
    }
  }

  private async handleGetRedisOrderbook(ws: AuthenticatedWebSocket, data: RedisOrderbookData): Promise<void> {
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
        user_id: ws.user_id,
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

        // Handle WebSocket upgrade with authentication
        if (
          server.upgrade(req, {
            // Pass the request URL through data so it's available in the WebSocket handlers
            data: { url: req.url },
          })
        ) {
          return; // Upgraded to WebSocket
        }

        // Handle HTTP requests
        return new Promise((resolve) => {
          if (url.pathname === "/health") {
            resolve(
              new Response(
                JSON.stringify({
                  status: "ok",
                  timestamp: new Date().toISOString(),
                  connectedClients: this.websockets.size,
                }),
                {
                  headers: { "Content-Type": "application/json" },
                }
              )
            );
          } else if (url.pathname === "/api/pairs") {
            resolve(
              new Response(JSON.stringify(this.tradingPairs), {
                headers: { "Content-Type": "application/json" },
              })
            );
          } else {
            resolve(new Response("Not Found", { status: 404 }));
          }
        });
      },
      websocket: {
        open: async (ws: AuthenticatedWebSocket) => {
          const wsId = randomUUID();
          // Extract user ID from connection URL
          const userId = this.extractUserIdFromUrl(ws?.data?.url || "");

          if (!userId) {
            console.log(`Connection rejected: No user ID provided`);
            ws.send(
              JSON.stringify({
                type: "error",
                data: {
                  type: "authentication_error",
                  message: "User ID is required to connect. Please provide userId as query parameter.",
                  timestamp: new Date().toISOString(),
                },
              })
            );
            ws.close(1008, "User ID required");
            return;
          }

          if (!this.validateUserId(userId)) {
            console.log(`Connection rejected: Invalid user ID format: ${userId}`);
            ws.send(
              JSON.stringify({
                type: "error",
                data: {
                  type: "authentication_error",
                  message: "Invalid user ID format",
                  timestamp: new Date().toISOString(),
                },
              })
            );
            ws.close(1008, "Invalid user ID");
            return;
          }

          // Authenticate user
          const isAuthenticated = await this.authenticateUser(userId);
          if (!isAuthenticated) {
            console.log(`Connection rejected: User authentication failed: ${userId}`);
            ws.send(
              JSON.stringify({
                type: "error",
                data: {
                  type: "authentication_error",
                  message: "User authentication failed",
                  timestamp: new Date().toISOString(),
                },
              })
            );
            ws.close(1008, "Authentication failed");
            return;
          }

          // Setup authenticated WebSocket
          const authWs = ws as AuthenticatedWebSocket;
          authWs.id = wsId;
          authWs.user_id = userId;
          authWs.isAuthenticated = true;

          this.websockets.set(wsId, authWs);
          this.userSubscriptions.set(wsId, new Set());

          console.log(`Client connected: ${wsId} (user: ${userId})`);

          // Send connection success and available trading pairs
          this.sendMessage(authWs, "connection_established", {
            user_id: userId,
            session_id: wsId,
          });

          this.sendMessage(authWs, "trading_pairs", this.tradingPairs);
        },
        message: (ws, message) => {
          const authWs = ws as AuthenticatedWebSocket;
          this.handleWebSocketMessage(authWs, message.toString());
        },
        close: (ws) => {
          const authWs = ws as AuthenticatedWebSocket;
          const wsId = authWs.id;
          const userId = authWs.user_id;
          console.log(`Client disconnected: ${wsId} (user: ${userId})`);
          this.cleanupUserSubscriptions(wsId);
        },
      },
    });

    console.log(`Trading WebSocket Server running on port ${port}`);
    console.log(`WebSocket URL: ws://localhost:${port}?user_id=<USER_ID>`);
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
