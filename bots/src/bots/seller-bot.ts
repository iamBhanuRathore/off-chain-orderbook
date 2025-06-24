// seller-bot.ts
import WebSocket from "ws";

interface TradingPair {
  symbol: string;
  base_asset: string;
  quote_asset: string;
  enabled: boolean;
  description: string;
}

interface OrderbookSnapshot {
  symbol: string;
  bids: Array<{ price: number; quantity: number; score: number }>;
  asks: Array<{ price: number; quantity: number; score: number }>;
  last_traded_price: number | null;
}

interface BotConfig {
  serverUrl: string;
  tradingSymbol: string;
  userId: string;
  minOrderSize: number;
  maxOrderSize: number;
  orderFrequency: number; // milliseconds
  priceVarianceMin: number; // 0.98 for 98%
  priceVarianceMax: number; // 1.02 for 102%
}

class SellerBot {
  private ws: WebSocket | null = null;
  private config: BotConfig;
  private isConnected: boolean = false;
  private currentLTP: number | null = null;
  private tradingPairs: TradingPair[] = [];
  private orderInterval: NodeJS.Timeout | null = null;
  private orderHistory: Array<any> = [];
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;

  constructor(config: BotConfig) {
    this.config = config;
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    process.on("SIGINT", () => {
      console.log("\n🛑 Seller Bot shutting down gracefully...");
      this.disconnect();
      process.exit(0);
    });
  }

  public async connect(): Promise<void> {
    try {
      console.log(`🔄 Seller Bot connecting to ${this.config.serverUrl}...`);

      this.ws = new WebSocket(this.config.serverUrl);

      this.ws.on("open", () => {
        console.log("✅ Seller Bot connected successfully");
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.subscribeToOrderbook();
        this.requestInitialSnapshot();
      });

      this.ws.on("message", (data: Buffer) => {
        this.handleMessage(data.toString());
      });

      this.ws.on("close", (code: number, reason: Buffer) => {
        console.log(`❌ Seller Bot connection closed: ${code} - ${reason.toString()}`);
        this.isConnected = false;
        this.stopTrading();
        this.attemptReconnect();
      });

      this.ws.on("error", (error: Error) => {
        console.error("❌ Seller Bot WebSocket error:", error.message);
      });
    } catch (error) {
      console.error("❌ Failed to connect Seller Bot:", error);
      this.attemptReconnect();
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log("❌ Max reconnection attempts reached. Bot stopping.");
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);

    console.log(`🔄 Seller Bot attempting reconnection in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    setTimeout(() => {
      this.connect();
    }, delay);
  }

  private handleMessage(message: string): void {
    try {
      const parsed = JSON.parse(message);
      const { type, data } = parsed;

      switch (type) {
        case "trading_pairs":
          this.tradingPairs = data;
          console.log(`📊 Seller Bot received ${data.length} trading pairs`);
          break;

        case "subscribed":
          console.log(`📈 Seller Bot subscribed to ${data.symbol} orderbook`);
          break;

        case "orderbook_snapshot":
          this.handleOrderbookSnapshot(data);
          break;

        case "redis_orderbook":
          this.handleRedisOrderbook(data);
          break;

        case "orderbook_delta":
          this.handleOrderbookDelta(data);
          break;

        case "trade":
          this.handleTrade(data);
          break;

        case "order_submitted":
          this.handleOrderSubmitted(data);
          break;

        case "error":
          console.error(`❌ Seller Bot server error: ${data.message}`);
          break;

        default:
          console.log(`📝 Seller Bot received: ${type}`, data);
      }
    } catch (error) {
      console.error("❌ Failed to parse message:", error);
    }
  }

  private handleOrderbookSnapshot(data: any): void {
    const snapshot: OrderbookSnapshot = data.snapshot;
    if (snapshot.last_traded_price) {
      this.currentLTP = snapshot.last_traded_price;
      console.log(`💰 Seller Bot LTP updated from snapshot: $${this.currentLTP}`);

      if (!this.orderInterval) {
        this.startTrading();
      }
    }
  }

  private handleRedisOrderbook(data: any): void {
    if (data.last_traded_price) {
      this.currentLTP = data.last_traded_price;
      console.log(`💰 Seller Bot LTP updated from Redis: $${this.currentLTP}`);

      if (!this.orderInterval) {
        this.startTrading();
      }
    }
  }

  private handleOrderbookDelta(data: any): void {
    // Handle real-time orderbook updates
    if (data.data && data.data.last_traded_price) {
      this.currentLTP = data.data.last_traded_price;
    }
  }

  private handleTrade(data: any): void {
    // Handle trade updates to get latest price
    if (data.data && data.data.price) {
      this.currentLTP = parseFloat(data.data.price);
      console.log(`💰 Seller Bot LTP updated from trade: $${this.currentLTP}`);
    }
  }

  private handleOrderSubmitted(data: any): void {
    console.log(`✅ Seller Bot order submitted: ${data.side} ${data.quantity} @ $${data.price}`);
    this.orderHistory.push({
      ...data,
      timestamp: new Date().toISOString(),
      status: "submitted",
    });
  }

  private subscribeToOrderbook(): void {
    if (this.ws && this.isConnected) {
      const subscribeMessage = {
        type: "subscribe_orderbook",
        data: {
          symbol: this.config.tradingSymbol,
        },
      };
      this.ws.send(JSON.stringify(subscribeMessage));
    }
  }

  private requestInitialSnapshot(): void {
    if (this.ws && this.isConnected) {
      // Request snapshot
      const snapshotMessage = {
        type: "request_snapshot",
        data: {
          symbol: this.config.tradingSymbol,
        },
      };
      this.ws.send(JSON.stringify(snapshotMessage));

      // Also request Redis orderbook
      const redisMessage = {
        type: "get_redis_orderbook",
        data: {
          symbol: this.config.tradingSymbol,
          limit: 10,
        },
      };
      this.ws.send(JSON.stringify(redisMessage));
    }
  }

  private startTrading(): void {
    if (this.orderInterval) {
      return; // Already trading
    }

    console.log(`🚀 Seller Bot starting automated trading every ${this.config.orderFrequency}ms`);

    this.orderInterval = setInterval(() => {
      this.placeSellOrder();
    }, this.config.orderFrequency);
  }

  private stopTrading(): void {
    if (this.orderInterval) {
      clearInterval(this.orderInterval);
      this.orderInterval = null;
      console.log("⏹️ Seller Bot trading stopped");
    }
  }

  private placeSellOrder(): void {
    if (!this.isConnected || !this.currentLTP || !this.ws) {
      console.log("⚠️ Seller Bot cannot place order: not connected or no LTP");
      return;
    }

    try {
      // Calculate sell price: LTP * (0.98 + Math.random() * 0.04) = 98-102% of LTP
      const priceMultiplier = this.config.priceVarianceMin + Math.random() * (this.config.priceVarianceMax - this.config.priceVarianceMin);

      const sellPrice = (this.currentLTP * priceMultiplier).toFixed(2);

      // Random order size between min and max
      const quantity = (this.config.minOrderSize + Math.random() * (this.config.maxOrderSize - this.config.minOrderSize)).toFixed(4);

      const orderMessage = {
        type: "place_order",
        data: {
          symbol: this.config.tradingSymbol,
          user_id: this.config.userId,
          order_type: "limit",
          side: "sell",
          price: sellPrice,
          quantity: quantity,
        },
      };

      this.ws.send(JSON.stringify(orderMessage));

      console.log(`📊 Seller Bot placed SELL order: ${quantity} @ $${sellPrice} (${(priceMultiplier * 100).toFixed(2)}% of LTP $${this.currentLTP})`);
    } catch (error) {
      console.error("❌ Seller Bot failed to place order:", error);
    }
  }

  public disconnect(): void {
    this.stopTrading();

    if (this.ws) {
      this.isConnected = false;
      this.ws.close();
      this.ws = null;
    }

    console.log("👋 Seller Bot disconnected");
  }

  public getStats(): any {
    return {
      isConnected: this.isConnected,
      currentLTP: this.currentLTP,
      totalOrders: this.orderHistory.length,
      tradingSymbol: this.config.tradingSymbol,
      orderHistory: this.orderHistory.slice(-10), // Last 10 orders
    };
  }
}

// Configuration
const sellerConfig: BotConfig = {
  serverUrl: "ws://localhost:4000",
  tradingSymbol: "BTCUSDT", // Change this to match your trading pair
  userId: "1002", // Unique user ID for seller bot
  minOrderSize: 0.001,
  maxOrderSize: 0.1,
  orderFrequency: 1000, // 1 second (will be 500ms when combined with buyer bot)
  priceVarianceMin: 0.98, // 98% of LTP
  priceVarianceMax: 1.02, // 102% of LTP
};

// Initialize and start the seller bot
const sellerBot = new SellerBot(sellerConfig);

async function startSellerBot() {
  try {
    await sellerBot.connect();

    // Status logging every 30 seconds
    setInterval(() => {
      const stats = sellerBot.getStats();
      console.log(`📊 Seller Bot Status: Connected: ${stats.isConnected}, LTP: $${stats.currentLTP}, Orders: ${stats.totalOrders}`);
    }, 30000);
  } catch (error) {
    console.error("❌ Failed to start Seller Bot:", error);
  }
}

// Start the bot
startSellerBot();

export default SellerBot;
