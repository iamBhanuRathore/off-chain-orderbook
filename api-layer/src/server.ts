// src/server.ts
import express from "express";
import type { Express, Request, Response } from "express";
import cors from "cors";
import marketRoutes from "./routes/marketRoutes";
import userRoutes from "./routes/userRoutes";
import { errorHandler } from "./middleware/errorHandler";
import { prisma } from "./lib/db";

const app: Express = express();
const PORT = process.env.PORT || 3000;
// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({ status: "ok", timestamp: new Date() });
});

// API Routes
app.use("/api/v1", marketRoutes);
app.use("/api/v1", userRoutes);

// 404 Handler for undefined routes
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: "Not Found" });
});

// Central Error Handler (must be last middleware)
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`✅ API Server is running on http://localhost:${PORT}`);
  console.log("Ensure the Rust Matching Engine is running.");
});
