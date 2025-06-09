
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as React from "react";
import { motion } from "framer-motion";
import Image from "next/image"; 

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OrderFormSchema } from "@/lib/schemas";
import type { OrderFormData, TradingSymbol } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Bitcoin, DollarSign } from "lucide-react"; 

interface OrderFormPanelProps {
  selectedSymbol: TradingSymbol;
  userAvailableBase: number;
  userAvailableQuote: number;
}

export function OrderFormPanel({ selectedSymbol, userAvailableBase, userAvailableQuote }: OrderFormPanelProps) {
  const { toast } = useToast();
  const [activeOuterTab, setActiveOuterTab] = React.useState<"buy" | "sell">("buy");
  const [activeInnerTab, setActiveInnerTab] = React.useState<"limit" | "market">("limit");
  
  const form = useForm<OrderFormData>({
    resolver: zodResolver(OrderFormSchema),
    defaultValues: {
      symbol: selectedSymbol,
      side: activeOuterTab,
      type: activeInnerTab,
      price: undefined,
      amount: undefined,
    },
  });

  React.useEffect(() => {
    form.reset({
      symbol: selectedSymbol,
      side: activeOuterTab,
      type: activeInnerTab,
      price: form.getValues("type") === "market" ? undefined : form.getValues("price"),
      amount: undefined, 
    });
  }, [selectedSymbol, activeOuterTab, activeInnerTab, form]);
  
  const orderType = form.watch("type");
  const price = form.watch("price");
  const amount = form.watch("amount");

  const total = React.useMemo(() => {
    if (activeInnerTab === 'market' || !price || !amount) return undefined;
    return price * amount;
  }, [activeInnerTab, price, amount]);

  function onSubmit(data: OrderFormData) {
    const finalData = { ...data, type: activeInnerTab };
    if (finalData.type === "market") {
      delete finalData.price; 
    }
    toast({
      title: "Order Submitted",
      description: `Your ${finalData.side.toUpperCase()} ${finalData.type.toUpperCase()} order for ${finalData.amount} ${finalData.symbol.split('/')[0]} has been submitted.`,
      variant: "default",
    });
    console.log("Order data:", finalData);

    const fulfillmentDelay = Math.random() * 3000 + 2000;
    setTimeout(() => {
      const isSuccessful = Math.random() > 0.1; 
      if (isSuccessful) {
        toast({
          title: "🎉 Order Fulfilled!",
          description: `Your ${finalData.side.toUpperCase()} order for ${finalData.amount} ${finalData.symbol.split('/')[0]} fulfilled.`,
          variant: "default", 
        });
      } else {
        toast({
          title: "Order Failed",
          description: `Your ${finalData.side.toUpperCase()} order for ${finalData.amount} ${finalData.symbol.split('/')[0]} could not be fulfilled.`,
          variant: "destructive",
        });
      }
    }, fulfillmentDelay);

    form.reset({
      symbol: selectedSymbol,
      side: activeOuterTab,
      type: activeInnerTab, 
      price: undefined,
      amount: undefined,
    });
  }
  
  const currentAsset = selectedSymbol.split('/');
  const baseAsset = currentAsset[0]; 
  const quoteAsset = currentAsset[1]; 

  const availableEquity = activeOuterTab === 'buy' ? userAvailableQuote : userAvailableBase;
  const equityAsset = activeOuterTab === 'buy' ? quoteAsset : baseAsset;


  return (
    <Card className="w-full h-full flex flex-col bg-card text-foreground">
      <Tabs value={activeOuterTab} onValueChange={(value) => setActiveOuterTab(value as "buy" | "sell")} className="w-full">
        <CardHeader className="p-0">
          <TabsList className="grid w-full grid-cols-2 rounded-none h-10">
            <TabsTrigger value="buy" className="text-sm rounded-none data-[state=active]:bg-green-600/80 data-[state=active]:text-white data-[state=active]:shadow-none">Buy / Long</TabsTrigger>
            <TabsTrigger value="sell" className="text-sm rounded-none data-[state=active]:bg-destructive/80 data-[state=active]:text-white data-[state=active]:shadow-none">Sell / Short</TabsTrigger>
          </TabsList>
        </CardHeader>
      </Tabs>

      <CardContent className="p-2 flex-grow flex flex-col space-y-1"> 
        <Tabs value={activeInnerTab} onValueChange={(value) => setActiveInnerTab(value as "limit" | "market")} className="w-full">
          <TabsList className="grid w-full grid-cols-2 h-7 bg-muted p-1 text-muted-foreground rounded-md"> 
            <TabsTrigger value="limit" className="text-xs py-1 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">Limit</TabsTrigger>
            <TabsTrigger value="market" className="text-xs py-1 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">Market</TabsTrigger>
          </TabsList>
        
          {(["buy", "sell"] as const).map(side => (
            activeOuterTab === side && 
            <TabsContent key={`${side}-${activeInnerTab}`} value={activeInnerTab} className="mt-2"> 
              <motion.form 
                key={`${side}-${activeInnerTab}-form`}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                onSubmit={form.handleSubmit(onSubmit)} 
                className="space-y-1.5" 
              >
                <div className="flex justify-between items-center text-xs">
                  <Label className="text-muted-foreground">Available Equity</Label>
                  <span className="font-medium text-foreground">{availableEquity.toFixed(equityAsset === 'USD' ? 2 : 4)} {equityAsset}</span>
                </div>

                {activeInnerTab !== "market" && (
                  <div className="space-y-1">
                    <Label htmlFor={`price-${side}`} className="text-xs text-muted-foreground">Price</Label>
                    <div className="relative">
                      <Input 
                        id={`price-${side}`} 
                        type="number" 
                        step="any" 
                        {...form.register("price")} 
                        placeholder="0.0" 
                        className="text-xs pr-10 h-8" 
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{quoteAsset}</span>
                    </div>
                    {form.formState.errors.price && <p className="text-xs text-destructive mt-0.5">{form.formState.errors.price.message}</p>}
                  </div>
                )}

                <div className="space-y-1">
                  <Label htmlFor={`amount-${side}`} className="text-xs text-muted-foreground">Quantity</Label>
                   <div className="relative">
                    <Input 
                        id={`amount-${side}`} 
                        type="number" 
                        step="any" 
                        {...form.register("amount")} 
                        placeholder="0.0000" 
                        className="text-xs pr-10 h-8" 
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-primary">
                         {baseAsset === 'BTC' ? <Bitcoin size={12}/> : <DollarSign size={12}/>}
                      </span>
                   </div>
                  {form.formState.errors.amount && <p className="text-xs text-destructive mt-0.5">{form.formState.errors.amount.message}</p>}
                </div>

                {activeInnerTab === 'limit' && total !== undefined && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Order Value</Label>
                     <div className="relative">
                        <Input type="text" value={total.toFixed(2)} readOnly className="text-xs pr-10 h-8"/> 
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-green-500">
                            <DollarSign size={12}/>
                        </span>
                     </div>
                  </div>
                )}
                
                <Button type="submit" className={cn("w-full mt-1.5 text-sm h-8", side === "buy" ? "bg-green-600 hover:bg-green-700" : "bg-destructive hover:bg-destructive/90", "text-white")}> 
                  {side === "buy" ? `Buy / Long ${baseAsset}` : `Sell / Short ${baseAsset}`}
                </Button>
                
              </motion.form>
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}

