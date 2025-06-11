"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AVAILABLE_SYMBOLS } from "@/lib/constants";
import type { TradingSymbol } from "@/types";
import { Bitcoin } from "lucide-react"; // Example icon

interface MarketSelectorProps {
  selectedSymbol: TradingSymbol;
  onSymbolChange: (symbol: TradingSymbol) => void;
}

export function MarketSelector({ selectedSymbol, onSymbolChange }: MarketSelectorProps) {
  return (
    <Select value={selectedSymbol} onValueChange={(value) => onSymbolChange(value as TradingSymbol)}>
      <SelectTrigger className="w-[180px] bg-transparent border-none shadow-none focus:ring-0 h-auto py-1 px-2">
        <div className="flex items-center gap-2">
          {/* Example: Show BTC icon for BTC/USD */}
          {selectedSymbol.startsWith("BTC") && <Bitcoin className="h-5 w-5 text-primary" />}
          {selectedSymbol.startsWith("ETH") && <span className="font-bold text-primary text-lg">Ξ</span>}
          {selectedSymbol.startsWith("SOL") && <span className="font-bold text-purple-400 text-lg">S</span>}
          <SelectValue placeholder="Select Symbol" />
        </div>
      </SelectTrigger>
      <SelectContent className="bg-card border-border">
        {AVAILABLE_SYMBOLS.map((symbol) => (
          <SelectItem key={symbol} value={symbol} className="focus:bg-muted">
            <div className="flex items-center gap-2">
              {symbol.startsWith("BTC") && <Bitcoin className="h-4 w-4 text-primary" />}
              {symbol.startsWith("ETH") && <span className="font-bold text-primary">Ξ</span>}
              {symbol.startsWith("SOL") && <span className="font-bold text-purple-400">S</span>}
              {symbol}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
