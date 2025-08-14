// src/server.ts
import express from "express";
import type { Express, Request, Response } from "express";
import cors from "cors";
import http from "http";
import marketRoutes from "./routes/marketRoutes";
import userRoutes from "./routes/userRoutes";
import { errorHandler } from "./middleware/errorHandler";
import { redisManager } from "./services/redis";

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

const server = http.createServer(app);

const startServer = async () => {
  try {
    await redisManager.connect();
    server.listen(PORT, () => {
      console.log(`✅ API Server is running on http://localhost:${PORT}`);
      console.log("Ensure the Rust Matching Engine is running.");
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

const gracefulShutdown = async () => {
  console.log("Shutting down gracefully...");
  server.close(async () => {
    console.log("HTTP server closed.");
    await redisManager.disconnect();
    process.exit(0);
  });
};

process.on("SIGINT", gracefulShutdown);
process.on("SIGTERM", gracefulShutdown);

startServer();
