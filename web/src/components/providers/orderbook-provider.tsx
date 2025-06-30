// src/components/providers/orderbook-provider.tsx
"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { useSocket } from "@/components/providers/socket-provider";
import { useSelectedMarket } from "@/components/providers/market-context";
import { MarketType, Side } from "@/types"; // Make sure all your types are in types.ts and exported
interface OrderBookEntry {
  price: number;
  quantity: number;
  score?: number;
}

interface WebSocketMessage {
  type: string;
  data: any;
  timestamp?: string;
}

interface OrderBookData {
  symbol: string;
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
  last_traded_price: number | null;
}

interface DeltaData {
  channel: string;
  data: {
    side: "Buy" | "Sell";
    price: string;
    new_quantity: string;
    action: "New" | "Update" | "Delete";
  };
}

interface TradeData {
  channel: string;
  data: {
    price: number;
    quantity: number;
    side: "Buy" | "Sell";
    timestamp: string;
  };
}
// --- Define the shape of the context value ---
interface OrderBookContextType {
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
  lastTradedPrice: number | null;
  latestTrade: TradeData["data"] | null;
  isSubscribed: boolean;
  placeOrder: (orderData: { user_id: string; order_type: MarketType; side: Side; price?: string; quantity: string }) => void;
  cancelOrder: (orderId: string) => void;
  requestSnapshot: () => void;
}

const OrderBookContext = createContext<OrderBookContextType | undefined>(undefined);

export function OrderBookProvider({ children }: { children: ReactNode }) {
  const { selectedSymbol: symbol } = useSelectedMarket();
  const { isConnected, socket } = useSocket();
  const [bids, setBids] = useState<OrderBookEntry[]>([]);
  const [asks, setAsks] = useState<OrderBookEntry[]>([]);
  const [lastTradedPrice, setLastTradedPrice] = useState<number | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [latestTrade, setLatestTrade] = useState<TradeData["data"] | null>(null);

  // Message handler
  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const message: WebSocketMessage = JSON.parse(event.data);

      switch (message.type) {
        case "trading_pairs":
          console.log("Available trading pairs:", message.data);
          break;

        case "subscribed":
          console.log("Successfully subscribed to:", message.data);
          setIsSubscribed(true);
          break;

        case "redis_orderbook":
          console.log("Received orderbook snapshot:", message.data);
          const orderbookData: OrderBookData = message.data;
          setBids(orderbookData.bids || []);
          setAsks(orderbookData.asks || []);
          setLastTradedPrice(orderbookData.last_traded_price);
          break;

        case "orderbook_delta":
          console.log("Received orderbook delta:", message.data);
          handleOrderBookDelta(message.data as DeltaData);
          break;

        case "trade":
          console.log("Received trade:", message.data);
          const tradeData = message.data as TradeData;
          setLatestTrade(tradeData.data);
          setLastTradedPrice(tradeData.data.price);
          break;

        case "error":
          console.error("WebSocket error:", message.data);
          break;

        default:
          console.log("Unhandled message type:", message.type, message.data);
      }
    } catch (error) {
      console.error("Error parsing WebSocket message:", error);
    }
  }, []);

  // Handle orderbook delta updates
  const handleOrderBookDelta = useCallback((deltaData: DeltaData) => {
    const { side, price, new_quantity, action } = deltaData.data;

    if (side === "Buy") {
      setBids((prevBids) => updateOrderBookLevel(prevBids, parseFloat(price), parseFloat(new_quantity), action));
    } else if (side === "Sell") {
      setAsks((prevAsks) => updateOrderBookLevel(prevAsks, parseFloat(price), parseFloat(new_quantity), action));
    }
  }, []);

  // Helper function to update orderbook levels
  const updateOrderBookLevel = (levels: OrderBookEntry[], price: number, quantity: number, action: DeltaData["data"]["action"]): OrderBookEntry[] => {
    const newLevels = [...levels];
    const existingIndex = newLevels.findIndex((level) => level.price === price);

    if (action === "Delete" || quantity === 0) {
      if (existingIndex !== -1) {
        newLevels.splice(existingIndex, 1);
      }
    } else if (action === "New" || action === "Update") {
      if (existingIndex !== -1) {
        newLevels[existingIndex] = { ...newLevels[existingIndex], quantity };
      } else {
        newLevels.push({ price, quantity });
      }
    }

    // Sort bids (highest first) and asks (lowest first)
    return newLevels.sort((a, b) => (levels === bids ? b.price - a.price : a.price - b.price));
  };

  // Subscribe to orderbook updates
  useEffect(() => {
    if (isConnected && socket && symbol) {
      // Set up message handler
      socket.onmessage = handleMessage;

      // Subscribe to orderbook updates
      socket.send(
        JSON.stringify({
          type: "subscribe_orderbook",
          data: { symbol: symbol.symbol },
        })
      );

      // Request initial orderbook snapshot
      socket.send(
        JSON.stringify({
          type: "get_redis_orderbook",
          data: { symbol: symbol.symbol, limit: 20 },
        })
      );

      return () => {
        // Unsubscribe when component unmounts or symbol changes
        if (socket && socket.readyState === WebSocket.OPEN) {
          socket.send(
            JSON.stringify({
              type: "unsubscribe_orderbook",
              data: { symbol: symbol.symbol },
            })
          );
        }
        setIsSubscribed(false);
        setBids([]);
        setAsks([]);
        setLastTradedPrice(null);
        setLatestTrade(null);
      };
    }
  }, [isConnected, socket, symbol, handleMessage]);

  // Place order function
  const placeOrder = useCallback(
    (orderData: { user_id: string; order_type: MarketType; side: Side; price?: string; quantity: string }) => {
      if (socket && isConnected) {
        socket.send(
          JSON.stringify({
            type: "place_order",
            data: {
              symbol: symbol.symbol,
              ...orderData,
            },
          })
        );
      }
    },
    [socket, isConnected, symbol]
  );

  // Cancel order function
  const cancelOrder = useCallback(
    (orderId: string) => {
      if (socket && isConnected) {
        socket.send(
          JSON.stringify({
            type: "cancel_order",
            data: {
              symbol: symbol.symbol,
              order_id: orderId,
            },
          })
        );
      }
    },
    [socket, isConnected, symbol]
  );

  // Request fresh snapshot
  const requestSnapshot = useCallback(() => {
    if (socket && isConnected) {
      socket.send(
        JSON.stringify({
          type: "request_snapshot",
          data: { symbol: symbol.symbol },
        })
      );
    }
  }, [socket, isConnected, symbol]);
  console.log(bids, asks, lastTradedPrice, isSubscribed, latestTrade);
  const value = {
    bids,
    asks,
    lastTradedPrice,
    latestTrade,
    isSubscribed,
    placeOrder,
    cancelOrder,
    requestSnapshot,
  };

  return <OrderBookContext.Provider value={value}>{children}</OrderBookContext.Provider>;
}

// Custom hook to consume the context
export function useOrderBook() {
  const context = useContext(OrderBookContext);
  if (context === undefined) {
    throw new Error("useOrderBook must be used within an OrderBookProvider");
  }
  return context;
}
