// src/middleware/validator.ts

import type{ Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';

// Define the schema using Zod
const orderSchema = z.object({
    symbol: z.string().min(1).toUpperCase(),
    userId: z.number().int().positive(),
    orderType: z.enum(['Limit', 'Market']),
    side: z.enum(['Buy', 'Sell']),
    quantity: z.string().regex(/^[0-9]+(\.[0-9]+)?$/, "Quantity must be a valid number string"),
    price: z.string().regex(/^[0-9]+(\.[0-9]+)?$/, "Price must be a valid number string").optional(),
})
// Use .superRefine for complex, cross-field validation
.superRefine((data, ctx) => {
    // If the order is a 'Limit' order, the 'price' field must be present and valid.
    if (data.orderType === 'Limit' && (!data.price || parseFloat(data.price) <= 0)) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "A price is required for Limit orders and must be greater than 0",
            path: ['price'], // Specify which field the error belongs to
        });
    }
});

// THIS IS THE MAGIC! We infer the TypeScript type directly from the schema.
// You no longer need to define OrderPayload in a separate file.
export type OrderPayload = z.infer<typeof orderSchema>;


export const validateOrder = (req: Request, res: Response, next: NextFunction): void => {
    try {
        // .parse will throw an error if validation fails
        const validatedData = orderSchema.parse(req.body);
        
        // Best practice: replace the raw body with the parsed (and transformed) data
        req.body = validatedData; 

        next();
    } catch (error) {
        if (error instanceof ZodError) {
            // Send a structured error response
            res.status(400).json({
                error: "Validation failed",
                details: error.flatten().fieldErrors,
            });
        } else {
            // Handle unexpected errors
            res.status(500).json({ error: "Internal Server Error" });
        }
    }
};