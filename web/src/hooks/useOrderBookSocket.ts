"use client";
import { useState, useEffect, useCallback } from "react";
// import type { OrderBookEntry, TradingSymbol } from "@/types";
// import { MOCK_ORDER_BOOK_BIDS, MOCK_ORDER_BOOK_ASKS } from "@/lib/constants";
import { useSocket } from "@/components/providers/socket-provider";
import { MarketType, Side } from "@/types";

// Helper function to simulate price/quantity fluctuations
// const fluctuate = (value: number, factor: number = 0.005, precision: number = 2) => {
//   const fluctuatedValue = value * (1 + (Math.random() - 0.5) * 2 * factor);
//   return parseFloat(fluctuatedValue.toFixed(precision));
// };

// const generateUpdatedOrders = (currentOrders: OrderBookEntry[], isBids: boolean, symbol: TradingSymbol): OrderBookEntry[] => {
//   // Simulate more dynamic changes: some orders update, some are removed, new ones added
//   let updated = currentOrders
//     .map((order) => {
//       if (Math.random() < 0.7) {
//         // 70% chance to update existing order
//         return {
//           ...order,
//           price: fluctuate(order.price, 0.002, 2), // Price fluctuates less
//           quantity: fluctuate(order.quantity, 0.1, 4), // Quantity fluctuates more
//         };
//       }
//       return null; // 30% chance to remove order
//     })
//     .filter((order) => order !== null) as OrderBookEntry[];

//   // Add a new order occasionally
//   if (Math.random() < 0.3 && updated.length < 15) {
//     // 30% chance to add if not too many
//     const basePrice = isBids ? updated[0]?.price || MOCK_ORDER_BOOK_BIDS[0]?.price || 40000 : updated[0]?.price || MOCK_ORDER_BOOK_ASKS[0]?.price || 40010;
//     const newPrice = fluctuate(basePrice, isBids ? -0.001 : 0.001, 2); // New bids slightly lower, new asks slightly higher
//     const newQuantity = fluctuate(0.5, 0.5, 4); // Random quantity for new order
//     updated.push({ price: newPrice, quantity: newQuantity, total: 0 }); // Total will be recalculated
//   }

//   return updated
//     .map((order) => ({ ...order, total: parseFloat((order.price * order.quantity).toFixed(2)) }))
//     .sort((a, b) => (isBids ? b.price - a.price : a.price - b.price)) // Resort bids descending, asks ascending
//     .slice(0, 12); // Keep a manageable number of orders for display
// };

// export function useOrderBookSocket(symbol: TradingSymbol) {
//   const [bids, setBids] = useState<OrderBookEntry[]>([]);
//   const [asks, setAsks] = useState<OrderBookEntry[]>([]);
//   const intervalRef = useRef<NodeJS.Timeout | null>(null);

//   useEffect(() => {
//     // Initialize with mock data for the current symbol
//     // In a real app, MOCK_ORDER_BOOK_BIDS/ASKS would be filtered or fetched based on the symbol
//     const initialBids = MOCK_ORDER_BOOK_BIDS.map(b => ({...b})).slice(0,10); // Use a copy
//     const initialAsks = MOCK_ORDER_BOOK_ASKS.map(a => ({...a})).slice(0,10); // Use a copy
//     setBids(initialBids);
//     setAsks(initialAsks);

//     if (intervalRef.current) {
//       clearInterval(intervalRef.current);
//     }

//     intervalRef.current = setInterval(() => {
//       setBids(prevBids => generateUpdatedOrders(prevBids, true, symbol));
//       setAsks(prevAsks => generateUpdatedOrders(prevAsks, false, symbol));
//     }, 1500); // Update every 1.5 seconds for a more active feel

//     return () => {
//       if (intervalRef.current) {
//         clearInterval(intervalRef.current);
//       }
//     };
//   }, [symbol]);

//   return { bids, asks };
// }

// Types based on your server implementation
interface OrderBookEntry {
  price: number;
  quantity: number;
  score?: number;
}

interface TradingSymbol {
  symbol: string;
  base_asset: string;
  quote_asset: string;
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
export function useOrderBookSocket(symbol: TradingSymbol) {
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

  return {
    bids,
    asks,
    lastTradedPrice,
    latestTrade,
    isSubscribed,
    placeOrder,
    cancelOrder,
    requestSnapshot,
  };
}
