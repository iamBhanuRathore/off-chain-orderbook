// src/middleware/validator.ts

import type{ Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';

// Define the schema using Zod, aligned with Prisma schema
const orderSchema = z.object({
    symbol: z.string().min(1, "Symbol is required").toUpperCase(),
    userId: z.string().cuid({ message: "Invalid CUID for userId" }),
    orderType: z.enum(['Market', 'Limit', 'StopLimit', 'StopMarket']),
    side: z.enum(['Buy', 'Sell']),
    quantity: z.string().regex(/^[0-9]+(\.[0-9]+)?$/, "Quantity must be a valid number string"),
    price: z.string().regex(/^[0-9]+(\.[0-9]+)?$/, "Price must be a valid number string").optional(),
    timeInForce: z.enum(['GTC', 'IOC', 'FOK']).optional().default('GTC'),
    stopPrice: z.string().regex(/^[0-9]+(\.[0-9]+)?$/, "Stop price must be a valid number string").optional(),
    clientOrderId: z.string().optional(),
})
.superRefine((data, ctx) => {
    if (data.orderType === 'Limit' && (!data.price || parseFloat(data.price) <= 0)) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "A price is required for Limit orders and must be greater than 0",
            path: ['price'],
        });
    }
    if ((data.orderType === 'StopLimit' || data.orderType === 'StopMarket') && (!data.stopPrice || parseFloat(data.stopPrice) <= 0)) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "A stopPrice is required for Stop orders and must be greater than 0",
            path: ['stopPrice'],
        });
    }
    if (data.orderType === 'StopLimit' && (!data.price || parseFloat(data.price) <= 0)) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "A price is required for StopLimit orders and must be greater than 0",
            path: ['price'],
        });
    }
});

// Infer the TypeScript type from the Zod schema
export type OrderPayload = z.infer<typeof orderSchema>;

export const validateOrder = (req: Request, res: Response, next: NextFunction): void => {
    try {
        const validatedData = orderSchema.parse(req.body);
        req.body = validatedData; 
        next();
    } catch (error) {
        if (error instanceof ZodError) {
            res.status(400).json({
                error: "Validation failed",
                details: error.flatten().fieldErrors,
            });
        } else {
            res.status(500).json({ error: "Internal Server Error" });
        }
    }
};
