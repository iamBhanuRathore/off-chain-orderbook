"use client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import type { OpenOrderEntry, OrderHistoryEntry } from "@/types";
import { XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface OrdersTableProps {
  data: OpenOrderEntry[] | OrderHistoryEntry[];
  isHistory?: boolean;
}

export function OrdersTable({ data, isHistory = false }: OrdersTableProps) {
  const { toast } = useToast();

  const handleCancelOrder = (orderId: string) => {
    // Placeholder for actual cancel order API call
    console.log("Cancel order:", orderId);
    toast({
      title: "Order Cancellation Requested",
      description: `Request to cancel order ${orderId} submitted.`,
    });
  };

  return (
    <div className="overflow-y-auto max-h-60 text-sm">
    <Table>
      <TableHeader className="sticky top-0 bg-card z-10">
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Pair</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Side</TableHead>
          <TableHead className="text-right">Price</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          <TableHead className="text-right">Filled</TableHead>
          <TableHead className="text-right">Total</TableHead>
          <TableHead>Status</TableHead>
          {!isHistory && <TableHead className="text-right">Action</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((order) => (
          <TableRow key={order.id} className="hover:bg-muted/80">
            <TableCell className="py-2 px-2 text-xs text-muted-foreground">{order.date}</TableCell>
            <TableCell className="py-2 px-2">{order.pair}</TableCell>
            <TableCell className="py-2 px-2">{order.type}</TableCell>
            <TableCell className={cn("py-2 px-2", order.side === "Buy" ? "text-emerald-500" : "text-rose-500")}>
              {order.side}
            </TableCell>
            <TableCell className="text-right py-2 px-2 tabular-nums">{order.price.toFixed(2)}</TableCell>
            <TableCell className="text-right py-2 px-2 tabular-nums">{order.amount.toFixed(4)}</TableCell>
            <TableCell className="text-right py-2 px-2 tabular-nums">{typeof order.filled === 'number' ? `${order.filled}%` : order.filled}</TableCell>
            <TableCell className="text-right py-2 px-2 tabular-nums">{order.total.toFixed(2)}</TableCell>
            <TableCell className="py-2 px-2">{order.status}</TableCell>
            {!isHistory && (
              <TableCell className="text-right py-2 px-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-destructive"
                  onClick={() => handleCancelOrder(order.id)}
                  aria-label="Cancel order"
                >
                  <XCircle className="h-4 w-4" />
                </Button>
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
    </div>
  );
}
