// src/types.ts
import WebSocket from 'ws';

export interface TradingPair {
    symbol: string;
    base_asset: string;
    quote_asset: string;
    enabled: boolean;
}

export interface PlaceOrderPayload {
    symbol: string;
    user_id: string; // User ID can be a string
    order_type: 'Limit' | 'Market';
    side: 'Buy' | 'Sell';
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

// A WebSocket instance augmented with a unique ID
export interface ClientWebSocket extends WebSocket {
    id: string;
}

// Structure for messages from the client to the server
export type ClientEvent = 
    | 'place_order' 
    | 'cancel_order' 
    | 'subscribe_orderbook' 
    | 'unsubscribe_orderbook' 
    | 'request_snapshot' 
    | 'get_redis_orderbook';

export interface ClientMessage {
    event: ClientEvent;
    payload: any;
}

// Structure for messages from the server to the client
export type ServerEvent =
    | 'trading_pairs'
    | 'order_submitted'
    | 'cancel_submitted'
    | 'subscribed'
    | 'unsubscribed'
    | 'orderbook_snapshot'
    | 'redis_orderbook'
    | 'orderbook_delta'
    | 'trade'
    | 'error';

export interface ServerMessage {
    event: ServerEvent;
    payload: any;
}