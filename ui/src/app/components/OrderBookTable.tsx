
"use client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { OrderBookEntry } from "@/types";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface OrderBookTableProps {
  data: OrderBookEntry[];
  type: "bids" | "asks";
  maxCumulativeQuantity: number;
  baseAsset: string;
  quoteAsset: string;
}

export function OrderBookTable({ data, type, maxCumulativeQuantity, baseAsset, quoteAsset }: OrderBookTableProps) {
  const isBids = type === "bids";
  
  const rowVariants = {
    initial: { opacity: 0, y: type === "asks" ? -10 : 10 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: type === "asks" ? 10 : -10, transition: { duration: 0.15 } },
  };

  // Determine decimal places - default to 2 for price/total, 4 for quantity
  // This could be made more sophisticated based on asset type
  const pricePrecision = 2;
  const quantityPrecision = baseAsset === 'BTC' ? 5 : 2; // More for BTC, less for others like SOL
  const totalPrecision = baseAsset === 'BTC' ? 5 : 2;


  return (
    <div className="relative text-xs"> 
      <Table className="relative">
        <TableHeader className="sticky top-0 bg-card z-10">
          <TableRow className="border-none">
            <TableHead className="w-1/3 py-1.5 px-2 text-left text-muted-foreground font-normal">Price ({quoteAsset})</TableHead>
            <TableHead className="w-1/3 text-right py-1.5 px-2 text-muted-foreground font-normal">Size ({baseAsset})</TableHead>
            <TableHead className="w-1/3 text-right py-1.5 px-2 text-muted-foreground font-normal">Total ({baseAsset})</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <AnimatePresence initial={false}>
            {data.map((entry, index) => {
              const depthPercentage = maxCumulativeQuantity > 0 ? (entry.total / maxCumulativeQuantity) * 100 : 0;
              const key = `${type}-${entry.price}-${entry.quantity}-${index}-${Math.random()}`; 
              
              return (
                <motion.tr
                  key={key}
                  layout
                  variants={rowVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={{ duration: 0.2, ease: "circOut" }}
                  className="relative hover:bg-muted/10 border-none"
                >
                  <TableCell className={cn(
                      "py-0.5 px-2 tabular-nums text-left w-1/3 font-mono", 
                      isBids ? "text-green-500" : "text-destructive"
                    )}>
                    {entry.price.toFixed(pricePrecision)}
                  </TableCell>
                  <TableCell className="py-0.5 px-2 text-right tabular-nums w-1/3 font-mono text-foreground/90">
                    {entry.quantity.toFixed(quantityPrecision)}
                  </TableCell>
                  <TableCell className="py-0.5 px-2 text-right tabular-nums relative w-1/3 font-mono text-foreground/70">
                     <div
                      className={cn(
                        "absolute top-0 bottom-0 right-0 h-full opacity-25", // Changed to right-0
                        isBids ? "bg-green-500" : "bg-destructive" 
                      )}
                      style={{ width: `${depthPercentage}%` }}
                    />
                    <span className="relative z-10">{entry.total.toFixed(totalPrecision)}</span>
                  </TableCell>
                </motion.tr>
              )
            })}
          </AnimatePresence>
        </TableBody>
      </Table>
    </div>
  );
}
