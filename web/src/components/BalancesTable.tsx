import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { BalanceEntry } from "@/types";

interface BalancesTableProps {
  data: BalanceEntry[];
}

export function BalancesTable({ data }: BalancesTableProps) {
  return (
    <div className="overflow-y-auto max-h-60 text-sm">
    <Table>
      <TableHeader className="sticky top-0 bg-card z-10">
        <TableRow>
          <TableHead>Asset</TableHead>
          <TableHead className="text-right">Total</TableHead>
          <TableHead className="text-right">Available</TableHead>
          <TableHead className="text-right">Locked</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((balance) => (
          <TableRow key={balance.asset} className="hover:bg-muted/80">
            <TableCell className="font-medium py-2 px-2">{balance.asset}</TableCell>
            <TableCell className="text-right py-2 px-2 tabular-nums">{balance.total.toFixed(balance.asset === 'USD' ? 2 : 8)}</TableCell>
            <TableCell className="text-right py-2 px-2 tabular-nums">{balance.available.toFixed(balance.asset === 'USD' ? 2 : 8)}</TableCell>
            <TableCell className="text-right py-2 px-2 tabular-nums">{balance.locked.toFixed(balance.asset === 'USD' ? 2 : 8)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
    </div>
  );
}
