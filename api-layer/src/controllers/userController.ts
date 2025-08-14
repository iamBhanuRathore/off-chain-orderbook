import { getOrdersByUserId } from "@/services/orderService";
import * as userService from "@/services/userService";
import type { Request, Response, NextFunction } from "express";
import { OrderStatus } from "@/generated/prisma";
import { createUserSchema } from "@/schemas/userSchema";
import bcrypt from "bcrypt";
import { resourceUsage } from "process";

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

export const createUser = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { email, password } = createUserSchema.parse(req.body);
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await userService.createUser({
      email,
      password: hashedPassword,
    });
    res.status(201).json({ user });
  } catch (error) {
    next(error);
  }
};

export const getUser = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;
    const user = await userService.getUserById(id as string);
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }
    res.status(200).json({ user });
  } catch (error) {
    next(error);
  }
};
