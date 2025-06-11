
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { TradeEntry } from "@/types";
import { cn } from "@/lib/utils";

interface TradesTableProps {
  data: TradeEntry[];
}

export function TradesTable({ data }: TradesTableProps) {
  return (
    <div className="flex-grow overflow-y-auto text-xs">
      <Table>
        <TableHeader className="sticky top-0 bg-card z-10">
          <TableRow className="border-none">
            <TableHead className="w-1/3 py-1.5 px-2 text-muted-foreground font-normal">Price (USD)</TableHead>
            <TableHead className="w-1/3 text-right py-1.5 px-2 text-muted-foreground font-normal">Quantity (BTC)</TableHead>
            <TableHead className="w-1/3 text-right py-1.5 px-2 text-muted-foreground font-normal">Time</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((trade) => (
            <TableRow key={trade.id} className="hover:bg-muted/10 border-none">
              <TableCell className={cn("py-0.5 px-2 font-mono", trade.side === "buy" ? "text-green-500" : "text-destructive")}>
                {trade.price.toFixed(1)}
              </TableCell>
              <TableCell className="py-0.5 px-2 text-right tabular-nums font-mono text-foreground/90">{trade.quantity.toFixed(5)}</TableCell>
              <TableCell className="py-0.5 px-2 text-right text-muted-foreground tabular-nums font-mono">{trade.time}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
