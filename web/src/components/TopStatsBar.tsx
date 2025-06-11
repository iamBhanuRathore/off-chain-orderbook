
"use client";
import * as React from "react";
import { MarketSelector } from "./MarketSelector";
import type { TradingSymbol } from "@/types";
import { AVAILABLE_SYMBOLS } from "@/lib/constants";
import { ChevronDown, TrendingUp, Zap } from "lucide-react"; // Added icons

interface StatItemProps {
  label: string;
  value: string | React.ReactNode;
  valueColor?: string;
  labelColor?: string;
  className?: string;
}

const StatItem: React.FC<StatItemProps> = ({ label, value, valueColor = "text-foreground", labelColor = "text-muted-foreground", className }) => (
  <div className={`flex flex-col items-start ${className}`}>
    <span className={`text-xs ${labelColor}`}>{label}</span>
    <span className={`text-sm font-medium ${valueColor}`}>{value}</span>
  </div>
);


export function TopStatsBar() {
  const [selectedSymbol, setSelectedSymbol] = React.useState<TradingSymbol>(AVAILABLE_SYMBOLS[0]);

  // Mock data based on the image
  const mockPrice = "105,889.9";
  const mockIndexPrice = "105,909.1";
  const mock24hChangeValue = "+25.2";
  const mock24hChangePercent = "+0.02%";
  const mockFundingRate = "0.0021%";
  const mockFundingCountdown = "01:23:22";
  const mock24hHigh = "106,491.4";
  const mock24hLow = "104,996.2";
  const mock24hVolume = "43,693,778.33 USD";
  const mockOpenInterest = "589.39990 BTC";
  const mockProfitAPY = "4.76%";


  return (
    <div className="bg-card border-b border-border p-3 flex items-center gap-4 overflow-x-auto">
      <MarketSelector selectedSymbol={selectedSymbol} onSymbolChange={setSelectedSymbol} />
      
      <div className="h-8 border-l border-border mx-2"></div>

      <StatItem label="Last Price" value={mockPrice} valueColor="text-primary" className="min-w-[100px]" />
      <StatItem label="Index Price" value={mockIndexPrice} className="min-w-[100px]" />
      
      <div className="h-8 border-l border-border mx-2"></div>

      <StatItem label="24H Change" value={<span className="text-green-500">{mock24hChangeValue} ({mock24hChangePercent})</span>} className="min-w-[120px]" />
      <StatItem 
        label="Funding / Countdown" 
        value={<>{mockFundingRate} / <span className="text-muted-foreground">{mockFundingCountdown}</span></>}
        className="min-w-[180px]"
      />
      <StatItem label="24H High" value={mock24hHigh} className="min-w-[100px]" />
      <StatItem label="24H Low" value={mock24hLow} className="min-w-[100px]" />
      <StatItem label="24H Volume" value={mock24hVolume} className="min-w-[180px]" />
      <StatItem label="Open Interest" value={mockOpenInterest} className="min-w-[150px]" />
      <StatItem 
        label="Profit APY" 
        value={<span className="flex items-center text-green-400">{mockProfitAPY} <Zap size={14} className="ml-1" /></span>} 
        className="min-w-[100px]"
      />
    </div>
  );
}
