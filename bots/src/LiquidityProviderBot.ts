// src/LiquidityProviderBot.ts

import WebSocket from "ws";
import type { BotConfig } from "./bots.config";

interface WebSocketMessage {
  type: string;
  data: any;
}

export class LiquidityProviderBot {
  private readonly config: BotConfig;
  private ws: WebSocket | null = null;
  private lastTradedPrice: number | null = null;
  private tradingInterval: NodeJS.Timeout | null = null;
  private isConnected = false;
  private logPrefix: string;

  constructor(config: BotConfig) {
    this.config = config;
    this.logPrefix = `[${this.config.TRADING_SYMBOL}]`;
    this.connect();
  }

  public connect(): void {
    console.log(`${this.logPrefix} [INFO] Connecting to ${this.config.WEBSOCKET_URL}...`);
    this.ws = new WebSocket(this.config.WEBSOCKET_URL);

    this.ws.on("open", this.handleOpen.bind(this));
    this.ws.on("message", this.handleMessage.bind(this));
    this.ws.on("close", this.handleClose.bind(this));
    this.ws.on("error", this.handleError.bind(this));
  }

  private handleOpen(): void {
    this.isConnected = true;
    console.log(`${this.logPrefix} [SUCCESS] WebSocket connection established.`);
    this.subscribeToTrades();
    this.requestInitialLTP();
  }

  private handleMessage(data: WebSocket.RawData): void {
    try {
      const message: WebSocketMessage = JSON.parse(data.toString());

      if (message.type === "trade" && message.data?.channel?.includes(this.config.TRADING_SYMBOL)) {
        const tradePrice = parseFloat(message.data?.data?.price);
        if (!isNaN(tradePrice)) {
          this.lastTradedPrice = tradePrice;
          console.log(`${this.logPrefix} [LTP] Updated Last Traded Price: ${this.lastTradedPrice.toFixed(this.config.PRICE_PRECISION)}`);
        }
      } else if (message.type === "redis_orderbook" && message.data?.symbol === this.config.TRADING_SYMBOL) {
        const ltp = message.data?.last_traded_price;
        if (ltp && this.lastTradedPrice === null) {
          this.lastTradedPrice = parseFloat(ltp);
          console.log(`${this.logPrefix} [LTP] Initial Last Traded Price received: ${this.lastTradedPrice.toFixed(this.config.PRICE_PRECISION)}`);
          this.startTrading();
        }
      } else if (message.type === "order_submitted" && message.data?.symbol === this.config.TRADING_SYMBOL) {
        console.log(`${this.logPrefix} [ORDER] Submitted: ${message.data.side.toUpperCase()} ${message.data.quantity} @ ${message.data.price}`);
      } else if (message.type === "error") {
        console.error(`${this.logPrefix} [SERVER ERROR] Type: ${message.data.type} | Message: ${message.data.message}`);
      }
    } catch (error) {
      console.error(`${this.logPrefix} [ERROR] Failed to parse incoming message:`, error);
    }
  }

  private handleClose(): void {
    this.isConnected = false;
    console.log(`${this.logPrefix} [INFO] WebSocket connection closed. Reconnecting in ${this.config.RECONNECT_DELAY_MS / 1000}s...`);
    this.stopTrading();
    setTimeout(() => this.connect(), this.config.RECONNECT_DELAY_MS);
  }

  private handleError(error: Error): void {
    console.error(`${this.logPrefix} [ERROR] WebSocket error:`, error.message);
    this.ws?.close();
  }

  private sendMessage(type: string, data: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, data }));
    } else {
      console.error(`${this.logPrefix} [ERROR] Cannot send message, WebSocket is not open.`);
    }
  }

  private subscribeToTrades(): void {
    console.log(`${this.logPrefix} [INFO] Subscribing to orderbook...`);
    this.sendMessage("subscribe_orderbook", { symbol: this.config.TRADING_SYMBOL });
  }

  private requestInitialLTP(): void {
    console.log(`${this.logPrefix} [INFO] Requesting initial order book and LTP...`);
    this.sendMessage("get_redis_orderbook", { symbol: this.config.TRADING_SYMBOL, limit: 1 });
  }

  private startTrading(): void {
    if (this.tradingInterval) clearInterval(this.tradingInterval);
    this.tradingInterval = setInterval(this.placeOrderPair.bind(this), this.config.ORDER_INTERVAL_MS);
    console.log(`${this.logPrefix} [BOT] Trading started. Placing orders every ${this.config.ORDER_INTERVAL_MS}ms.`);
  }

  private stopTrading(): void {
    if (this.tradingInterval) {
      clearInterval(this.tradingInterval);
      this.tradingInterval = null;
      console.log(`${this.logPrefix} [BOT] Trading stopped.`);
    }
  }

  private placeOrderPair(): void {
    if (this.lastTradedPrice === null) {
      console.warn(`${this.logPrefix} [WARN] Cannot place orders, LTP is not available yet.`);
      return;
    }
    this.placeOrder("buy");
    this.placeOrder("sell");
  }

  private placeOrder(side: "buy" | "sell"): void {
    if (this.lastTradedPrice === null) return;

    const priceMultiplier = 1 + (Math.random() - 0.5) * this.config.PRICE_RANGE_PERCENT;
    const price = this.lastTradedPrice * priceMultiplier;
    const quantity = this.config.MIN_ORDER_SIZE + Math.random() * (this.config.MAX_ORDER_SIZE - this.config.MIN_ORDER_SIZE);

    const orderData = {
      symbol: this.config.TRADING_SYMBOL,
      user_id: side === "buy" ? this.config.BUYER_USER_ID : this.config.SELLER_USER_ID,
      order_type: "limit",
      side: side,
      price: price.toFixed(this.config.PRICE_PRECISION),
      quantity: quantity.toFixed(this.config.QUANTITY_PRECISION),
    };

    this.sendMessage("place_order", orderData);
  }
}
