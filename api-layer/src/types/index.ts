// src/types/index.ts
import type { orderSchema } from "@/schemas/orderSchema";
import type { Side } from "../generated/prisma/client";
import type z from "zod";

export interface OrderBookLevel {
  price: string;
  quantity: string;
}

export interface Trade {
  id: string;
  market: string;
  price: string;
  quantity: string;
  takerSide: Side;
  buyOrderId: string;
  sellOrderId: string;
  buyerId: string;
  sellerId: string;
  fee: string;
  feeAsset: string;
  timestamp: string;
}

// Define a type for the user object
interface AppUser {
  id: string | number;
  type?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AppUser;
    }
  }
}

export type OrderSchema = z.infer<typeof orderSchema>;
