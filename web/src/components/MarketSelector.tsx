"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AVAILABLE_SYMBOLS } from "@/lib/constants";
import type { TradingSymbol } from "@/types";

interface MarketSelectorProps {
  selectedSymbol: TradingSymbol;
  onSymbolChange: (symbol: TradingSymbol) => void;
}

export function MarketSelector({ selectedSymbol, onSymbolChange }: MarketSelectorProps) {
  return (
    <Select
      value={selectedSymbol.symbol}
      onValueChange={(value) => {
        const newSymbol = AVAILABLE_SYMBOLS.find((s) => s.symbol === value);
        if (newSymbol) {
          onSymbolChange(newSymbol);
        }
      }}
    >
      <SelectTrigger className="w-[180px] bg-transparent border-none shadow-none focus:ring-0 h-auto py-1 px-2">
        <div className="flex items-center gap-2">
          <SelectValue placeholder="Select Symbol" />
        </div>
      </SelectTrigger>
      <SelectContent className="bg-card border-border">
        {AVAILABLE_SYMBOLS.map((symbol) => (
          <SelectItem key={symbol.symbol} value={symbol.symbol} className="focus:bg-muted">
            <div className="flex items-center gap-2">{symbol.symbol}</div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
