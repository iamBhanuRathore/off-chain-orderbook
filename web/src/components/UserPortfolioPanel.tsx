import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BalancesTable } from "./BalancesTable";
import { OrdersTable } from "./OpenOrdersTable";
import { MOCK_BALANCES, MOCK_OPEN_ORDERS, MOCK_ORDER_HISTORY } from "@/lib/constants";

export function UserPortfolioPanel() {
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="font-headline text-lg">My Portfolio</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="balances" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="balances">Balances</TabsTrigger>
            <TabsTrigger value="open-orders">Open Orders</TabsTrigger>
            <TabsTrigger value="order-history">Order History</TabsTrigger>
          </TabsList>
          <TabsContent value="balances" className="mt-4">
            <BalancesTable data={MOCK_BALANCES} />
          </TabsContent>
          <TabsContent value="open-orders" className="mt-4">
            <OrdersTable data={MOCK_OPEN_ORDERS} />
          </TabsContent>
          <TabsContent value="order-history" className="mt-4">
            <OrdersTable data={MOCK_ORDER_HISTORY} isHistory={true} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
