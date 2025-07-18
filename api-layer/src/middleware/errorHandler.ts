// src/middleware/errorHandler.ts

import type{ Request, Response, NextFunction } from 'express';

export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error(err.stack);

    res.status(500).json({
        error: "Internal Server Error",
        message: err.message
    });
};