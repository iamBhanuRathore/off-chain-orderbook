import { OrderType } from "@/generated/prisma";
import { Side } from "@/generated/prisma";
import { z } from "zod";

export const orderSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  order_type: z.enum(OrderType),
  side: z.enum(Side),
  price: z.string(),
  quantity: z.string(),
  timestamp: z.string(),
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
