// src/config/index.ts
import type { TradingPair } from "@/types";
import { readFileSync } from "fs";
import path from "path";

function loadTradingPairs(): TradingPair[] {
  try {
    const rawPairs = readFileSync(path.resolve(__dirname, "../../../markets.json"), "utf-8");
    const allPairs: TradingPair[] = JSON.parse(rawPairs);
    return allPairs.filter((pair) => pair.enabled);
  } catch (error) {
    console.error("Failed to load or parse markets.json:", error);
    return [];
  }
}

export const tradingPairs: TradingPair[] = loadTradingPairs();

export function isSymbolEnabled(symbol: string): boolean {
  return tradingPairs.some((pair) => pair.symbol === symbol);
}

console.log(`Loaded ${tradingPairs.length} enabled trading pairs.`);
