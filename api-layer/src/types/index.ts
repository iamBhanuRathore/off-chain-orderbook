// src/types/index.ts

export interface OrderPayload {
  symbol: string;
  userId: number;
  orderType: 'Limit' | 'Market';
  side: 'Buy' | 'Sell';
  quantity: string;
  price?: string; // Optional because it's not required for Market orders
}

export interface OrderBookLevel {
  price: string;
  quantity: string;
}

export interface Trade {
  id: string;
  taker_order_id: string;
  maker_order_id: string;
  price: string;
  quantity: string;
  timestamp: string;
};
