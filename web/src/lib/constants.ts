import type { TradingSymbol, OrderBookEntry, TradeEntry, BalanceEntry, OpenOrderEntry, OrderHistoryEntry } from "@/types";
import rawMarkets from "@/markets.json" assert { type: "json" };
export const AVAILABLE_SYMBOLS: TradingSymbol[] = rawMarkets as TradingSymbol[];
export const MOCK_ORDER_BOOK_BIDS: OrderBookEntry[] = [
  { price: 40000, quantity: 0.5, total: 20000, depth: 100 },
  { price: 39990, quantity: 1.2, total: 47988, depth: 80 },
  { price: 39985, quantity: 0.8, total: 31988, depth: 60 },
  { price: 39980, quantity: 2.0, total: 79960, depth: 40 },
  { price: 39970, quantity: 1.5, total: 59955, depth: 20 },
];

export const MOCK_ORDER_BOOK_ASKS: OrderBookEntry[] = [
  { price: 40010, quantity: 0.7, total: 28007, depth: 100 },
  { price: 40015, quantity: 1.0, total: 40015, depth: 80 },
  { price: 40020, quantity: 0.9, total: 36018, depth: 60 },
  { price: 40025, quantity: 1.8, total: 72045, depth: 40 },
  { price: 40030, quantity: 1.3, total: 52039, depth: 20 },
];

export const MOCK_RECENT_TRADES: TradeEntry[] = [
  { id: "t1", price: 40005, quantity: 0.2, time: "10:35:15", side: "Buy" },
  { id: "t2", price: 40000, quantity: 0.1, time: "10:35:02", side: "Sell" },
  { id: "t3", price: 40008, quantity: 0.3, time: "10:34:50", side: "Buy" },
  { id: "t4", price: 39995, quantity: 0.05, time: "10:34:33", side: "Sell" },
  { id: "t5", price: 40002, quantity: 0.15, time: "10:34:12", side: "Buy" },
];

export const MOCK_BALANCES: BalanceEntry[] = [
  { asset: "BTC", total: 1.25, available: 0.75, locked: 0.5 },
  { asset: "USD", total: 50000, available: 20000, locked: 30000 },
  { asset: "ETH", total: 10.0, available: 10.0, locked: 0.0 },
];

export const MOCK_OPEN_ORDERS: OpenOrderEntry[] = [
  { id: "o1", date: "2023-10-26 10:30", pair: "BTC/USD", type: "Limit", side: "Buy", price: 39500, amount: 0.1, filled: 0, total: 3950, status: "Open" },
  { id: "o2", date: "2023-10-26 09:15", pair: "ETH/USD", type: "Limit", side: "Sell", price: 1900, amount: 2.0, filled: 50, total: 3800, status: "Partially Filled" },
];

export const MOCK_ORDER_HISTORY: OrderHistoryEntry[] = [
  { id: "oh1", date: "2023-10-25 18:00", pair: "BTC/USD", type: "Limit", side: "Buy", price: 39000, amount: 0.2, filled: 100, total: 7800, status: "Filled" },
  { id: "oh2", date: "2023-10-25 14:20", pair: "BTC/USD", type: "Limit", side: "Sell", price: 41000, amount: 0.1, filled: 0, total: 4100, status: "Cancelled" },
];
