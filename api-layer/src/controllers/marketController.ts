import type { Request, Response, NextFunction } from "express";
import * as redisService from "../services/redisService";
import { orderSchema, type OrderPayload } from "../middleware/validator";
import z from "zod";

// Higher-order function to handle async errors
const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export const createOrder = asyncHandler(
  async (req: Request, res: Response) => {
    const orderPayload = req.body;
    const validation = orderSchema.safeParse(orderPayload);

    if (!validation.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: validation.error.flatten(),
      });
    }

    const result = await redisService.submitOrder(
      validation.data,
      validation.data.symbol,
    );
    res.status(202).json(result);
  },
);

export const deleteOrder = asyncHandler(async (req: Request<{ symbol: string; orderId: string }>, res: Response) => {
  const { symbol, orderId } = req.params;
  const result = await redisService.cancelOrder(symbol, orderId);
  res.status(202).json({ message: "Cancellation request submitted", ...result });
});

export const fetchOrderBook = asyncHandler(async (req: Request<{ symbol: string }>, res: Response) => {
  const { symbol } = req.params;
  const orderBook = await redisService.getOrderBook(symbol);
  res.status(200).json(orderBook);
});

export const fetchTicker = asyncHandler(async (req: Request<{ symbol: string }>, res: Response) => {
  const { symbol } = req.params;
  const ltp = await redisService.getLastTradedPrice(symbol);
  res.status(200).json(ltp);
});

export const fetchTrades = asyncHandler(async (req: Request<{ symbol: string }>, res: Response) => {
  const { symbol } = req.params;
  const trades = await redisService.getRecentTrades(symbol);
  res.status(200).json(trades);
});
