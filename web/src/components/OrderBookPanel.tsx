"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OrderBookTable } from "./OrderBookTable";
import { Button } from "@/components/ui/button";
import { Minus, Plus, ListTree, ArrowUpWideNarrow, ArrowDownWideNarrow, BookOpen, History } from "lucide-react";
import { useMemo, useState } from "react";
import { useOrderBookSocket } from "@/hooks/useOrderBookSocket";
import type { TradingSymbol } from "@/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TradesTable } from "./TradesTable";
import { MOCK_RECENT_TRADES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { ScrollArea } from "./ui/scroll-area";

interface OrderBookPanelProps {
  selectedSymbol: TradingSymbol;
}

type BookViewType = "combined" | "asks" | "bids";

export function OrderBookPanel({ selectedSymbol }: OrderBookPanelProps) {
  const { bids: bidsFromHook, asks: asksFromHook, lastTradedPrice, isSubscribed, latestTrade } = useOrderBookSocket(selectedSymbol);
  console.log(bidsFromHook, asksFromHook, lastTradedPrice, isSubscribed, latestTrade);

  const [aggregationLevel, setAggregationLevel] = useState(0.01);
  const [bookView, setBookView] = useState<BookViewType>("combined");

  const [baseAsset, quoteAsset] = [selectedSymbol.base_asset, selectedSymbol.quote_asset];

  const { processedAsks, processedBids, maxCumulativeAsk, maxCumulativeBid, lowestAskPrice, highestBidPrice, totalBidQuantity, totalAskQuantity } = useMemo(() => {
    let cumulativeAskQty = 0;
    const asksWithCumulative = asksFromHook.slice(0, 12).map((ask) => {
      cumulativeAskQty += ask.quantity;
      return { ...ask, total: cumulativeAskQty };
    });
    const processedAsksForTable = bookView === "bids" ? [] : [...asksWithCumulative].reverse();
    const maxAsk = cumulativeAskQty;
    const currentTotalAskQuantity = asksWithCumulative.reduce((sum, ask) => sum + ask.quantity, 0);

    let cumulativeBidQty = 0;
    const bidsWithCumulative = bidsFromHook.slice(0, 12).map((bid) => {
      cumulativeBidQty += bid.quantity;
      return { ...bid, total: cumulativeBidQty };
    });
    const processedBidsForTable = bookView === "asks" ? [] : bidsWithCumulative;
    const maxBid = cumulativeBidQty;
    const currentTotalBidQuantity = bidsWithCumulative.reduce((sum, bid) => sum + bid.quantity, 0);

    return {
      processedAsks: processedAsksForTable,
      processedBids: processedBidsForTable,
      maxCumulativeAsk: maxAsk,
      maxCumulativeBid: maxBid,
      lowestAskPrice: asksFromHook[0]?.price,
      highestBidPrice: bidsFromHook[0]?.price,
      totalBidQuantity: currentTotalBidQuantity,
      totalAskQuantity: currentTotalAskQuantity,
    };
  }, [asksFromHook, bidsFromHook, bookView]);

  const midPrice = lowestAskPrice !== undefined && highestBidPrice !== undefined ? (lowestAskPrice + highestBidPrice) / 2 : undefined;
  const spread = lowestAskPrice !== undefined && highestBidPrice !== undefined ? lowestAskPrice - highestBidPrice : 0;
  const spreadPercentage = midPrice && midPrice > 0 ? (spread / midPrice) * 100 : 0;

  const totalBookQuantity = totalBidQuantity + totalAskQuantity;
  const bidDepthPercentage = totalBookQuantity > 0 ? (totalBidQuantity / totalBookQuantity) * 100 : 0;
  const askDepthPercentage = totalBookQuantity > 0 ? (totalAskQuantity / totalBookQuantity) * 100 : 0;

  const aggregationLevels = [0.01, 0.1, 1, 10, 50, 100];
  const currentAggIndex = aggregationLevels.indexOf(aggregationLevel);

  const handleIncreaseAggregation = () => {
    if (currentAggIndex < aggregationLevels.length - 1) {
      setAggregationLevel(aggregationLevels[currentAggIndex + 1]);
    }
  };

  const handleDecreaseAggregation = () => {
    if (currentAggIndex > 0) {
      setAggregationLevel(aggregationLevels[currentAggIndex - 1]);
    }
  };

  return (
    <Card className="flex-1 flex flex-col h-full bg-card text-foreground">
      <Tabs defaultValue="orderbook" className="w-full flex-grow flex flex-col">
        <CardHeader className="p-0">
          <TabsList className="grid w-full grid-cols-2 rounded-none h-10 bg-card border-b border-border">
            <TabsTrigger
              value="orderbook"
              className="py-1 text-xs rounded-none data-[state=active]:shadow-none data-[state=active]:bg-muted data-[state=active]:text-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
            >
              <BookOpen size={14} className="mr-2" />
              Book
            </TabsTrigger>
            <TabsTrigger
              value="trades"
              className="py-1 text-xs rounded-none data-[state=active]:shadow-none data-[state=active]:bg-muted data-[state=active]:text-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
            >
              <History size={14} className="mr-2" />
              Trades
            </TabsTrigger>
          </TabsList>
        </CardHeader>

        <TabsContent value="orderbook" className={cn("flex flex-col h-full p-0 m-0 ", "data-[state=inactive]:hidden")}>
          <div className="flex justify-between items-center py-1.5 px-2 border-b border-border">
            <div className="flex items-center gap-0.5">
              <Button
                variant="ghost"
                size="icon"
                className={cn("h-6 w-6 text-muted-foreground hover:text-foreground", bookView === "combined" && "bg-muted text-foreground")}
                onClick={() => setBookView("combined")}
              >
                <ListTree size={14} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={cn("h-6 w-6 text-muted-foreground hover:text-foreground", bookView === "bids" && "bg-muted text-foreground")}
                onClick={() => setBookView("bids")}
              >
                <ArrowDownWideNarrow size={14} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={cn("h-6 w-6 text-muted-foreground hover:text-foreground", bookView === "asks" && "bg-muted text-foreground")}
                onClick={() => setBookView("asks")}
              >
                <ArrowUpWideNarrow size={14} />
              </Button>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" onClick={handleDecreaseAggregation} disabled={currentAggIndex === 0}>
                <Minus size={12} />
              </Button>
              <span className="text-xs w-8 text-center tabular-nums text-foreground">{aggregationLevel.toFixed(aggregationLevel >= 1 ? 0 : 2)}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                onClick={handleIncreaseAggregation}
                disabled={currentAggIndex === aggregationLevels.length - 1}
              >
                <Plus size={12} />
              </Button>
            </div>
          </div>
          <ScrollArea className="h-full">
            {bookView !== "bids" && (
              <div className="flex-grow overflow-y-auto">
                <OrderBookTable data={processedAsks} type="asks" maxCumulativeQuantity={maxCumulativeAsk} baseAsset={baseAsset} quoteAsset={quoteAsset} />
              </div>
            )}

            <div className="p-1 items-center text-center border-y border-border bg-card flex justify-between">
              {midPrice !== undefined ? (
                <span className="text-md font-medium text-green-500 tabular-  nums">{midPrice.toFixed(2)}</span>
              ) : (
                <span className="text-lg font-medium text-muted-foreground">-</span>
              )}
              {lowestAskPrice !== undefined && highestBidPrice !== undefined && (
                <p className="text-xs text-muted-foreground tabular-nums">
                  Spread: {spread.toFixed(2)} ({spreadPercentage.toFixed(2)}%)
                </p>
              )}
            </div>

            {bookView !== "asks" && (
              <div className="flex-grow overflow-y-auto">
                <OrderBookTable data={processedBids} type="bids" maxCumulativeQuantity={maxCumulativeBid} baseAsset={baseAsset} quoteAsset={quoteAsset} />
              </div>
            )}
          </ScrollArea>
          <div className="px-3 py-2 border-t border-border">
            <div className="h-3 bg-muted rounded-sm flex text-xs items-center relative">
              <div className="bg-green-500/80 h-full flex items-center justify-center text-white font-medium rounded-l-sm" style={{ width: `${bidDepthPercentage}%` }}>
                {bidDepthPercentage > 10 && <span className="text-[10px] leading-none">{Math.round(bidDepthPercentage)}%</span>}
              </div>
              <div className="bg-red-500 h-full flex items-center justify-center text-white font-medium rounded-r-sm" style={{ width: `${askDepthPercentage}%` }}>
                {askDepthPercentage > 10 && <span className="text-[10px] leading-none">{Math.round(askDepthPercentage)}%</span>}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="trades" className={cn("flex-grow flex flex-col p-0 m-0 overflow-hidden", "data-[state=inactive]:hidden")}>
          <div className="flex-grow overflow-y-auto">
            <TradesTable data={MOCK_RECENT_TRADES} />
          </div>
        </TabsContent>
      </Tabs>
    </Card>
  );
}
