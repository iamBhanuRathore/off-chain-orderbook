// src/constants.ts

/**
 * Normalizes a trading pair symbol for use in a Redis key.
 * e.g., "BTC_INR" -> "BTC_INR"
 * @param symbol The trading symbol.
 * @returns The uppercased symbol part of the key.
 */
const getSymbolKeyPart = (symbol: string): string => symbol.toUpperCase();

// --- Queue and Key Generation Functions ---

export const getOrderQueue = (symbol: string): string => `orderbook:orders:${getSymbolKeyPart(symbol)}`;

export const getCancelQueue = (symbol: string): string => `orderbook:cancel:${getSymbolKeyPart(symbol)}`;

export const getTradesKey = (symbol: string): string => `orderbook:trades:${getSymbolKeyPart(symbol)}`;

export const getLtpKey = (symbol: string): string => `orderbook:ltp:${getSymbolKeyPart(symbol)}`;

export const getBidsKey = (symbol: string): string => `orderbook:bids:${getSymbolKeyPart(symbol)}`;

export const getAsksKey = (symbol: string): string => `orderbook:asks:${getSymbolKeyPart(symbol)}`;

export const feePercentage = "0.2";
