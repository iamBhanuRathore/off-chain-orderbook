
"use client";
import { useState, useEffect, useRef } from 'react';
import type { OrderBookEntry, TradingSymbol } from '@/types';
import { MOCK_ORDER_BOOK_BIDS, MOCK_ORDER_BOOK_ASKS } from '@/lib/constants';

// Helper function to simulate price/quantity fluctuations
const fluctuate = (value: number, factor: number = 0.005, precision: number = 2) => {
  const fluctuatedValue = value * (1 + (Math.random() - 0.5) * 2 * factor);
  return parseFloat(fluctuatedValue.toFixed(precision));
};

const generateUpdatedOrders = (currentOrders: OrderBookEntry[], isBids: boolean, symbol: TradingSymbol): OrderBookEntry[] => {
  // Simulate more dynamic changes: some orders update, some are removed, new ones added
  let updated = currentOrders.map(order => {
    if (Math.random() < 0.7) { // 70% chance to update existing order
      return {
        ...order,
        price: fluctuate(order.price, 0.002, 2), // Price fluctuates less
        quantity: fluctuate(order.quantity, 0.1, 4), // Quantity fluctuates more
      };
    }
    return null; // 30% chance to remove order
  }).filter(order => order !== null) as OrderBookEntry[];

  // Add a new order occasionally
  if (Math.random() < 0.3 && updated.length < 15) { // 30% chance to add if not too many
    const basePrice = isBids ? (updated[0]?.price || MOCK_ORDER_BOOK_BIDS[0]?.price || 40000) : (updated[0]?.price || MOCK_ORDER_BOOK_ASKS[0]?.price || 40010);
    const newPrice = fluctuate(basePrice, isBids ? -0.001 : 0.001, 2); // New bids slightly lower, new asks slightly higher
    const newQuantity = fluctuate(0.5, 0.5, 4); // Random quantity for new order
    updated.push({ price: newPrice, quantity: newQuantity, total: 0 }); // Total will be recalculated
  }
  
  return updated
    .map(order => ({ ...order, total: parseFloat((order.price * order.quantity).toFixed(2)) }))
    .sort((a, b) => isBids ? b.price - a.price : a.price - b.price) // Resort bids descending, asks ascending
    .slice(0, 12); // Keep a manageable number of orders for display
};


export function useOrderBookSocket(symbol: TradingSymbol) {
  const [bids, setBids] = useState<OrderBookEntry[]>([]);
  const [asks, setAsks] = useState<OrderBookEntry[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Initialize with mock data for the current symbol
    // In a real app, MOCK_ORDER_BOOK_BIDS/ASKS would be filtered or fetched based on the symbol
    const initialBids = MOCK_ORDER_BOOK_BIDS.map(b => ({...b})).slice(0,10); // Use a copy
    const initialAsks = MOCK_ORDER_BOOK_ASKS.map(a => ({...a})).slice(0,10); // Use a copy
    setBids(initialBids);
    setAsks(initialAsks);

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    intervalRef.current = setInterval(() => {
      setBids(prevBids => generateUpdatedOrders(prevBids, true, symbol));
      setAsks(prevAsks => generateUpdatedOrders(prevAsks, false, symbol));
    }, 1500); // Update every 1.5 seconds for a more active feel

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [symbol]);

  return { bids, asks };
}
