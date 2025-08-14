import { getOrdersByUserId } from "@/services/orderService";
import type { Request, Response, NextFunction } from "express";
import { OrderStatus } from "@/generated/prisma";

export const getOrders = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { status } = req.query;
    const orders = await getOrdersByUserId(
      String(req.user?.id),
      status as OrderStatus,
    );
    res.status(200).json({ orders });
  } catch (error) {
    next(error);
  }
};
