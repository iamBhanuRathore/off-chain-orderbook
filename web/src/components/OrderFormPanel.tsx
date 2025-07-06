"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { type z } from "zod";
import { useForm } from "react-hook-form";
import * as React from "react";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OrderFormSchema } from "@/lib/schemas";
import { MarketType, Side, TradingSymbol } from "@/types"; // OrderFormData will be inferred
// import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Bitcoin, DollarSign } from "lucide-react";
import { type Resolver } from "react-hook-form";
import { useUser } from "./providers/user-context";
import { useOrderBook } from "./providers/orderbook-provider";

interface OrderFormPanelProps {
  selectedSymbol: TradingSymbol;
  userAvailableBase: number;
  userAvailableQuote: number;
}

// Infer the form data type directly from the Zod schema
type OrderFormValues = z.infer<typeof OrderFormSchema>;

export function OrderFormPanel({ selectedSymbol, userAvailableBase, userAvailableQuote }: OrderFormPanelProps) {
  // console.log(selectedSymbol);
  // const { toast } = useToast();
  const { placeOrder } = useOrderBook();
  const { user } = useUser();
  const [sideTab, setSideTab] = React.useState<Side>(Side.Buy);
  const [marketTypeTab, setMarketTypeTab] = React.useState<MarketType>(MarketType.Limit);

  const form = useForm<OrderFormValues>({
    resolver: zodResolver(OrderFormSchema) as Resolver<OrderFormValues>,
    defaultValues: {
      symbol: selectedSymbol.symbol,
      side: sideTab,
      type: marketTypeTab,
      price: undefined,
      amount: 0,
    },
  });
  const resetForm = () => {
    form.reset({
      symbol: selectedSymbol.symbol,
      side: sideTab,
      type: marketTypeTab,
      price: marketTypeTab === MarketType.Market ? undefined : form.getValues("price"),
      amount: 0,
    });
  };

  React.useEffect(() => {
    resetForm();
  }, [selectedSymbol, sideTab, marketTypeTab]);
  // const orderType = form.watch("type");
  const price = form.watch("price");
  const amount = form.watch("amount");

  const total = React.useMemo(() => {
    if (marketTypeTab === MarketType.Market || !price || !amount) return undefined;
    return price * amount;
  }, [marketTypeTab, price, amount]);

  function onSubmit(data: OrderFormValues) {
    console.log({ data });
    const finalData = { ...data, type: marketTypeTab };
    if (finalData.type === MarketType.Market) {
      delete finalData.price;
    }
    console.log("Order data:", finalData);
    placeOrder({
      order_type: finalData.type,
      quantity: finalData.amount.toString(),
      side: finalData.side,
      price: finalData.price?.toString(),
      user_id: user,
    });

    resetForm();
  }
  const [baseAsset, quoteAsset] = [selectedSymbol.base_asset, selectedSymbol.quote_asset];

  const availableEquity = sideTab === Side.Buy ? userAvailableQuote : userAvailableBase;
  const equityAsset = sideTab === Side.Buy ? quoteAsset : baseAsset;

  return (
    <Card className="w-full h-full flex flex-col bg-card text-foreground">
      <Tabs value={sideTab} onValueChange={(val) => setSideTab(val as Side)} className="w-full">
        <CardHeader className="p-0">
          <TabsList className="grid w-full grid-cols-2 rounded-none h-10">
            <TabsTrigger value={Side.Buy} className="text-sm rounded-none data-[state=active]:bg-green-600/80 data-[state=active]:text-white data-[state=active]:shadow-none">
              Buy / Long
            </TabsTrigger>
            <TabsTrigger value={Side.Sell} className="text-sm rounded-none data-[state=active]:bg-destructive/80 data-[state=active]:text-white data-[state=active]:shadow-none">
              Sell / Short
            </TabsTrigger>
          </TabsList>
        </CardHeader>
      </Tabs>

      <CardContent className="p-2 flex-grow flex flex-col space-y-1">
        <Tabs value={marketTypeTab} onValueChange={(value) => setMarketTypeTab(value as MarketType)} className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-muted p-1 text-muted-foreground rounded-md">
            <TabsTrigger value={MarketType.Limit} className="text-xs data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">
              Limit
            </TabsTrigger>
            <TabsTrigger value={MarketType.Market} className="text-xs data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">
              Market
            </TabsTrigger>
          </TabsList>

          {Object.values(Side).map(
            (side) =>
              sideTab === side && (
                <TabsContent key={`${side}-${marketTypeTab}`} value={marketTypeTab} className="mt-2">
                  <motion.form
                    key={`${side}-${marketTypeTab}-form`}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    onSubmit={form.handleSubmit(onSubmit)}
                    className="space-y-1.5"
                  >
                    <div className="flex justify-between items-center text-xs">
                      <Label className="text-muted-foreground">Available Equity</Label>
                      <span className="font-medium text-foreground">
                        {availableEquity.toFixed(equityAsset === "USD" ? 2 : 4)} {equityAsset}
                      </span>
                    </div>

                    {marketTypeTab !== MarketType.Market && (
                      <div className="space-y-1">
                        <Label htmlFor={`price-${side}`} className="text-xs text-muted-foreground">
                          Price
                        </Label>
                        <div className="relative">
                          <Input id={`price-${side}`} type="number" step="any" {...form.register("price")} placeholder="0.0" className="text-xs pr-10 h-8" />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{quoteAsset}</span>
                        </div>
                        {form.formState.errors.price && <p className="text-xs text-destructive mt-0.5">{form.formState.errors.price.message}</p>}
                      </div>
                    )}

                    <div className="space-y-1">
                      <Label htmlFor={`amount-${side}`} className="text-xs text-muted-foreground">
                        Quantity
                      </Label>
                      <div className="relative">
                        <Input id={`amount-${side}`} type="number" step="any" {...form.register("amount")} placeholder="0.0000" className="text-xs pr-10 h-8" />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-primary">{baseAsset === "BTC" ? <Bitcoin size={12} /> : <DollarSign size={12} />}</span>
                      </div>
                      {form.formState.errors.amount && <p className="text-xs text-destructive mt-0.5">{form.formState.errors.amount.message}</p>}
                    </div>

                    {marketTypeTab === MarketType.Limit && total !== undefined && (
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Order Value</Label>
                        <div className="relative">
                          <Input type="text" value={total.toFixed(2)} readOnly className="text-xs pr-10 h-8" />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-green-500">
                            <DollarSign size={12} />
                          </span>
                        </div>
                      </div>
                    )}

                    <Button type="submit" className={cn("w-full mt-1.5 text-sm h-8", side === Side.Buy ? "bg-green-600 hover:bg-green-700" : "bg-destructive hover:bg-destructive/90", "text-white")}>
                      {side === Side.Buy ? `Buy / Long ${baseAsset}` : `Sell / Short ${baseAsset}`}
                    </Button>
                  </motion.form>
                </TabsContent>
              )
          )}
        </Tabs>
      </CardContent>
    </Card>
  );
}
