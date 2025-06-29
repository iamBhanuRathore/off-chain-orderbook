export type TradingSymbol = {
  symbol: string;
  base_asset: string;
  quote_asset: string;
  enabled: boolean;
  description: string;
};

export interface OrderBookEntry {
  price: number;
  quantity: number;
  total: number;
  depth?: number; // Optional for visualizing depth
}

export interface TradeEntry {
  id: string;
  price: number;
  quantity: number;
  time: string; // ISO string or formatted
  side: Side;
}

export interface BalanceEntry {
  asset: string;
  total: number;
  available: number;
  locked: number;
}

export interface OpenOrderEntry {
  id: string;
  date: string; // ISO string or formatted
  pair: string; // e.g., "BTC/USD"
  type: MarketType;
  side: Side;
  price: number;
  amount: number;
  filled: number; // Percentage or absolute
  total: number;
  status: "Open" | "Partially Filled";
}

export interface OrderHistoryEntry extends OpenOrderEntry {
  status: "Filled" | "Cancelled" | "Partially Filled & Cancelled";
}
export enum MarketType {
  Limit,
  Market,
}
export enum Side {
  Buy,
  Sell,
}
export type OrderFormData = {
  symbol: TradingSymbol;
  side: Side;
  type: MarketType;
  price?: number;
  amount: number;
  total?: number; // For limit orders, if user specifies total value
};
