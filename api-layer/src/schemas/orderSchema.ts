import { z } from "zod";
import { OrderType, Side } from "@/generated/prisma";

export const orderSchema = z.object({
  userId: z.string().uuid(),
  orderType: z.nativeEnum(OrderType),
  side: z.nativeEnum(Side),
  price: z.string(),
  quantity: z.string(),
  symbol: z.string(),
  clientOrderId: z.string().optional(),
});

//  {
//   id: "79dd631c-8084-49bf-9a28-d956397773c5",
//   user_id: 100,
//   order_type: "Limit",
//   side: "Buy",
//   price: "95",
//   quantity: "1",
//   timestamp: "2025-07-16T19:05:03.252753Z",
// }
