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
  side: "Buy" | "Sell";
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
  type: "Limit" | "Market";
  side: "Buy" | "Sell";
  price: number;
  amount: number;
  filled: number; // Percentage or absolute
  total: number;
  status: "Open" | "Partially Filled";
}

export interface OrderHistoryEntry extends OpenOrderEntry {
  status: "Filled" | "Cancelled" | "Partially Filled & Cancelled";
}

export type OrderFormData = {
  symbol: TradingSymbol;
  side: "Buy" | "Sell";
  type: "limit" | "market";
  price?: number;
  amount: number;
  total?: number; // For limit orders, if user specifies total value
};
