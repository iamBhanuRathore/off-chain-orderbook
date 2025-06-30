import { z } from "zod";
// import { AVAILABLE_SYMBOLS } from "./constants";
import {
  MarketType,
  Side,
  //  type TradingSymbol
} from "@/types";

// const tradingSymbolEnum = z.custom<TradingSymbol>((val) => AVAILABLE_SYMBOLS.includes(val as TradingSymbol), {
//   message: "Invalid trading symbol",
// });

export const OrderFormSchema = z
  .object({
    // symbol:tradingSymbolEnum,
    symbol: z.string().min(1, { message: "Symbol is required" }),
    side: z.nativeEnum(Side),
    type: z.nativeEnum(MarketType),
    price: z.preprocess((val) => (val === "" ? undefined : Number(val)), z.number({ invalid_type_error: "Price must be a number" }).positive({ message: "Price must be positive" }).optional()),
    amount: z.preprocess((val) => Number(val), z.number({ required_error: "Amount is required", invalid_type_error: "Amount must be a number" }).positive({ message: "Amount must be positive" })),
    // Total might be auto-calculated or user-input for some order types
    // total: z.number().positive().optional(),
  })
  .refine(
    (data) => {
      if (data.type === MarketType.Limit && (data.price === undefined || data.price <= 0)) {
        return false;
      }
      return true;
    },
    {
      message: "Price is required for limit orders and must be positive",
      path: ["price"],
    }
  );
