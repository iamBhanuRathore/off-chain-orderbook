import { db } from "@/lib/db";
import type { Request, Response, NextFunction } from "express";

export const orderHistory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orders = await db.order.findMany({
      where: {
        userId: req.userId,
        status: {
          notIn: ["Open", "PartiallyFilled"],
        },
      },
    });
    res.status(200).json({ orders });
  } catch (error) {
    next(error);
  }
};
export const openOrders = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const openOrders = await db.order.findMany({
      where: {
        userId: req.userId,
        status: {
          in: ["Open", "PartiallyFilled"],
        },
      },
    });
    res.status(200).json({ openOrders });
  } catch (error) {
    next(error);
  }
};

export const myBalances = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const balances = await db.balance.findMany({
      where: {
        userId: req.userId,
      },
    });
    res.status(200).json({ balances });
  } catch (error) {
    next(error);
  }
};
