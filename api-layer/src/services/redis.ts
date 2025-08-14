import { createClient, type RedisClientType } from "redis";
import { processTradesWorker } from "./seedService";

class RedisManager {
  private static instance: RedisManager;
  private client: RedisClientType;
  private blockingClient: RedisClientType;
  private isConnected: boolean = false;

  private constructor() {
    this.client = createClient({
      url: process.env.REDIS_URL,
    });
    this.blockingClient = this.client.duplicate();

    this.client.on("error", (err: any) =>
      console.error("Redis Client Error", err),
    );
    this.client.on("connect", () => console.log("Redis client connected."));
    this.client.on("end", () => {
      console.log("Redis client disconnected.");
      this.isConnected = false;
    });
    this.client.on("reconnecting", () =>
      console.log("Redis client reconnecting..."),
    );

    this.blockingClient.on("error", (err: any) =>
      console.error("Redis Blocking Client Error", err),
    );
    this.blockingClient.on("connect", () =>
      console.log("Redis blocking client connected."),
    );
    this.blockingClient.on("end", () =>
      console.log("Redis blocking client disconnected."),
    );
    this.blockingClient.on("reconnecting", () =>
      console.log("Redis blocking client reconnecting..."),
    );
  }

  public static getInstance(): RedisManager {
    if (!RedisManager.instance) {
      RedisManager.instance = new RedisManager();
    }
    return RedisManager.instance;
  }
  public async connect(): Promise<void> {
    if (!this.isConnected) {
      try {
        await this.client.connect();
        await this.blockingClient.connect();
        this.isConnected = true;
        console.log("Redis clients connected successfully.");
        processTradesWorker(this.blockingClient);
        // processCancellationsWorker(this.blockingClient);
      } catch (error) {
        console.error("Failed to connect to Redis:", error);
        throw error;
      }
    } else {
      console.log("Redis clients are already connected.");
    }
  }
  public async disconnect(): Promise<void> {
    if (this.isConnected) {
      await this.client.quit();
      await this.blockingClient.quit();
      this.isConnected = false;
      console.log("Redis clients disconnected.");
    }
  }
  public getClient(): RedisClientType {
    if (!this.isConnected) {
      console.warn("Redis client is not connected. Operations may fail.");
    }
    return this.client;
  }
}

export const redisManager = RedisManager.getInstance();
