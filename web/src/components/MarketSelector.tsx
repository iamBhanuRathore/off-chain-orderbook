"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AVAILABLE_SYMBOLS } from "@/lib/constants";
import { useSelectedMarket } from "./providers/market-context";

export function MarketSelector() {
  const { selectedSymbol, setSelectedSymbol } = useSelectedMarket();
  return (
    <Select
      value={selectedSymbol.symbol}
      onValueChange={(value) => {
        const newSymbol = AVAILABLE_SYMBOLS.find((s) => s.symbol === value);
        if (newSymbol) {
          setSelectedSymbol(newSymbol);
        }
      }}
    >
      <SelectTrigger className="  ">
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
