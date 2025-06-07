import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { createClient } from "redis";
import type { RedisClientType } from "redis";
import { v4 as uuidv4 } from "uuid";
import Markets from "../../markets.json";

const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";
const ORDERS_QUEUE_BASE = "orderbook:orders"; // Base name for order queues

interface OrderPayload {
  id: string;
  user_id: number;
  trading_pair: string; // e.g., "BTC/USD"
  side: "Buy" | "Sell";
  price: string;
  quantity: string;
  timestamp: string;
  // order_type?: "Limit" | "Market"; // Optional for now
}

let redisClient: RedisClientType;

async function connectRedis(): Promise<RedisClientType> {
  if (redisClient && redisClient.isOpen) {
    return redisClient;
  }
  const client: RedisClientType = createClient({ url: REDIS_URL });
  client.on("error", (err: Error) => console.error("Redis Client Error", err));
  await client.connect();
  console.log("Connected to Redis successfully!");
  redisClient = client; // Assign to the global variable
  return redisClient;
}

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json()); // To parse JSON request bodies

// --- Routes ---

// Health Check
app.get("/health", (req: Request, res: Response) => {
  res.status(200).send("OK");
});

// Submit a new order
app.post("/orders", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body;
    console.log("Received order request:", body);

    // --- Basic Validation ---
    if (
      !body.user_id ||
      !body.trading_pair ||
      !body.side ||
      !body.price ||
      !body.quantity
    ) {
      res.status(400).json({ error: "Missing required order fields" });
      return;
    }
    if (
      !Markets.some(
        (market) => market.symbol === body.trading_pair && market.enabled,
      )
    ) {
      res.status(400).json({ error: "Invalid trading pair" });
      return;
    }
    if (body.side !== "Buy" && body.side !== "Sell") {
      res.status(400).json({ error: "Invalid order side" });
      return;
    }
    // TODO: Add more robust validation:
    // - Price and quantity format (should be valid numbers, positive)
    // - trading_pair format
    // - User existence and balance checks (would require another service call or DB lookup)

    const orderId = uuidv4();
    const timestamp = new Date().toISOString();

    const orderForEngine: OrderPayload = {
      id: orderId,
      user_id: parseInt(body.user_id),
      trading_pair: body.trading_pair.toUpperCase().trim(), // Standardize
      side: body.side,
      price: String(body.price), // Ensure string for decimal
      quantity: String(body.quantity), // Ensure string for decimal
      timestamp: timestamp,
    };

    const client = await connectRedis();
    const orderJson = JSON.stringify(orderForEngine);

    // Determine the pair-specific queue
    // Replace '/' with '_' or another safe char for Redis key names
    const pairKeySegment = orderForEngine.trading_pair.replace(/\//g, "_");
    const queueKey = `${ORDERS_QUEUE_BASE}:${pairKeySegment}`;

    // Using RPUSH for FIFO behavior with Rust consumer's BLPOP
    await client.rPush(queueKey, orderJson);
    console.log(
      `Order ${orderId} for ${orderForEngine.trading_pair} published to Redis queue: ${queueKey}`,
    );

    res.status(201).json({
      message: "Order received successfully",
      order_id: orderId,
      data: orderForEngine,
    });
    return;
  } catch (error) {
    console.error("Error processing order:", error);
    // Pass error to the global error handler
    next(error);
    return;
  }
});

// --- TODO: Add other order management routes ---
// app.delete('/orders/:orderId', ...)
// app.get('/orders/:orderId', ...)
// app.get('/users/:userId/orders', ...)

// Global Error Handler Middleware (must be last app.use())
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error("Unhandled Express error:", err.stack);
  res
    .status(500)
    .json({ error: "Internal Server Error", details: err.message });
});

// Start the server
app.listen(port, async () => {
  try {
    await connectRedis(); // Connect to Redis when server starts
    console.log(
      `Bun API server with Express listening on http://localhost:${port}`,
    );
    console.log(
      `Consuming Rust engine should listen to queues like: ${ORDERS_QUEUE_BASE}:BTC_USD`,
    );
  } catch (err) {
    console.error("Failed to start server or connect to Redis:", err);
    process.exit(1); // Exit if essential services can't start
  }
});

// Graceful shutdown for Redis client
async function gracefulShutdown() {
  console.log("Received shutdown signal. Closing Redis client...");
  if (redisClient && redisClient.isOpen) {
    try {
      await redisClient.quit();
      console.log("Redis client closed.");
    } catch (err) {
      console.error("Error closing Redis client:", err);
    }
  }
  process.exit(0);
}

process.on("SIGINT", gracefulShutdown);
process.on("SIGTERM", gracefulShutdown);
