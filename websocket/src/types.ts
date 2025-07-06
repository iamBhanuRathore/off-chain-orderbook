// src/types.ts
import type { ServerWebSocket } from "bun";

// --- Core Data Structures ---
export interface TradingPair {
  symbol: string;
  base_asset: string;
  quote_asset: string;
  enabled: boolean;
  description?: string;
}

export interface OrderbookLevel {
  price: number;
  quantity: number;
}

// A WebSocket instance augmented with a unique ID
export interface ClientWebSocket extends ServerWebSocket<{ id: string }> {
  id: string; // Manually attached ID for tracking
}

// --- Client -> Server Message Payloads ---
export interface PlaceOrderPayload {
  symbol: string;
  user_id: string;
  order_type: "Limit" | "Market";
  side: "Buy" | "Sell";
  price?: string; // Optional for Market orders
  quantity: string;
}

export interface CancelOrderPayload {
  symbol: string;
  order_id: string;
}

export interface SubscriptionPayload {
  symbol: string;
}

export interface SnapshotRequestPayload {
  symbol: string;
}

export interface RedisOrderbookPayload {
  symbol: string;
  limit?: number;
}

// --- Client -> Server Message Structure (Discriminated Union) ---
export type ClientMessage =
  | { event: "place_order"; payload: PlaceOrderPayload }
  | { event: "cancel_order"; payload: CancelOrderPayload }
  | { event: "subscribe_orderbook"; payload: SubscriptionPayload }
  | { event: "unsubscribe_orderbook"; payload: SubscriptionPayload }
  | { event: "request_snapshot"; payload: SnapshotRequestPayload }
  | { event: "get_redis_orderbook"; payload: RedisOrderbookPayload };

export type ClientEvent = ClientMessage["event"];

// --- Server -> Client Message Payloads ---
export interface ErrorPayload {
  type: string;
  message: string;
}

export interface OrderbookSnapshotPayload {
  symbol: string;
  bids: OrderbookLevel[];
  asks: OrderbookLevel[];
  last_traded_price: number | null;
}

// --- Server -> Client Message Structure (Discriminated Union) ---
export type ServerMessage =
  | { event: "trading_pairs"; payload: TradingPair[] }
  | { event: "order_submitted"; payload: PlaceOrderPayload }
  | { event: "cancel_submitted"; payload: CancelOrderPayload }
  | { event: "subscribed"; payload: { symbol: string; channels: string[] } }
  | { event: "unsubscribed"; payload: { symbol: string } }
  | { event: "orderbook_snapshot"; payload: any } // from matching engine
  | { event: "redis_orderbook"; payload: OrderbookSnapshotPayload }
  | { event: "orderbook_delta"; payload: any } // from matching engine
  | { event: "trade"; payload: any } // from matching engine
  | { event: "error"; payload: ErrorPayload };

export type ServerEvent = ServerMessage["event"];
