
"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DollarSign, Bitcoin, CreditCard } from "lucide-react"; // Added Bitcoin
import { MOCK_BALANCES } from "@/lib/constants"; // Using MOCK_BALANCES for asset list
import { useToast } from "@/hooks/use-toast";
import Image from "next/image";

// Get unique asset types from MOCK_BALANCES
const AVAILABLE_ASSETS = Array.from(new Set(MOCK_BALANCES.map(balance => balance.asset)));

export default function FundingPage() {
  const [selectedAsset, setSelectedAsset] = React.useState<string>(AVAILABLE_ASSETS[0] || "");
  const [amount, setAmount] = React.useState<string>("");
  const [depositAddress, setDepositAddress] = React.useState<string | null>(null);
  const { toast } = useToast();

  const handleGenerateAddress = () => {
    if (!selectedAsset) {
      toast({
        title: "Error",
        description: "Please select an asset.",
        variant: "destructive",
      });
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid amount.",
        variant: "destructive",
      });
      return;
    }

    // Simulate address generation
    let newAddress = "";
    if (selectedAsset === "BTC") {
      newAddress = `bc1q${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}xyz`;
    } else if (selectedAsset === "ETH") {
      newAddress = `0x${Math.random().toString(16).substring(2, 12)}${Math.random().toString(16).substring(2, 12)}abc`;
    } else if (selectedAsset === "USD") {
      newAddress = "Please proceed to our banking partner using reference: SWIFTTRADE-USD-" + Math.random().toString(36).substring(2, 10).toUpperCase();
    } else {
       newAddress = `${selectedAsset}_ADDRESS_${Math.random().toString(36).substring(2,15).toUpperCase()}`;
    }
    setDepositAddress(newAddress);

    toast({
      title: "Deposit Address Generated",
      description: `Deposit address for ${amount} ${selectedAsset} is now shown.`,
    });
  };

  const getAssetIcon = (asset: string) => {
    if (asset === "BTC") return <Bitcoin className="h-5 w-5 mr-2 text-orange-500" />;
    if (asset === "ETH") return <CreditCard className="h-5 w-5 mr-2 text-gray-400" />; // Placeholder, can use Ethereum icon if available
    if (asset === "USD") return <DollarSign className="h-5 w-5 mr-2 text-green-500" />;
    return <DollarSign className="h-5 w-5 mr-2 text-muted-foreground" />;
  }

  return (
    <div className="container mx-auto py-8">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <div className="flex items-center gap-4">
            <DollarSign className="h-12 w-12 text-primary" />
            <div>
              <CardTitle className="text-2xl">Fund Your Account</CardTitle>
              <CardDescription>Deposit assets into your SwiftTrade wallet.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="asset-select">Select Asset</Label>
            <Select value={selectedAsset} onValueChange={setSelectedAsset}>
              <SelectTrigger id="asset-select">
                <SelectValue placeholder="Choose an asset" />
              </SelectTrigger>
              <SelectContent>
                {AVAILABLE_ASSETS.map(asset => (
                  <SelectItem key={asset} value={asset}>
                    <div className="flex items-center">
                      {getAssetIcon(asset)}
                      {asset}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Amount</Label>
            <Input
              id="amount"
              type="number"
              placeholder="Enter amount to deposit"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          <Button onClick={handleGenerateAddress} className="w-full">
            Generate Deposit Information
          </Button>

          {depositAddress && (
            <Card className="mt-6 bg-muted/50 dark:bg-muted/30">
              <CardHeader>
                <CardTitle className="text-lg">Deposit Information for {selectedAsset}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Please send exactly <span className="font-semibold text-foreground">{amount} {selectedAsset}</span> to the address below.
                </p>
                <div className="p-3 border rounded-md bg-background break-all">
                  <p className="text-sm font-mono">{depositAddress}</p>
                </div>
                {selectedAsset !== "USD" && (
                   <div className="flex flex-col items-center space-y-2">
                     <p className="text-xs text-muted-foreground">Scan QR Code (Placeholder)</p>
                     <div className="p-2 border rounded-md bg-background">
                       <Image
                         src="https://placehold.co/150x150.png"
                         alt="QR Code Placeholder"
                         width={150}
                         height={150}
                         data-ai-hint="QR code"
                       />
                     </div>
                   </div>
                )}
                <p className="text-xs text-destructive">
                  Ensure you are sending {selectedAsset}. Sending any other asset to this address may result in the loss of your deposit.
                </p>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
