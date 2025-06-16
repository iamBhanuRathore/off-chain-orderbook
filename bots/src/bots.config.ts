// src/bots.config.ts

/**
 * Defines the structure for a single bot's configuration.
 * This ensures type safety and autocompletion when you define your bots.
 */
export interface BotConfig {
  // A friendly name for logging purposes
  name: string;
  // WebSocket URL of the trading platform server
  WEBSOCKET_URL: string;
  // The trading pair symbol the bot will operate on
  TRADING_SYMBOL: string;
  // Unique user IDs for the buyer and seller bots
  BUYER_USER_ID: string;
  SELLER_USER_ID: string;
  // The minimum and maximum quantity for each order
  MIN_ORDER_SIZE: number;
  MAX_ORDER_SIZE: number;
  // Interval to place a new pair of buy/sell orders (in milliseconds)
  ORDER_INTERVAL_MS: number;
  // Defines the price range around the LTP (Last Traded Price)
  PRICE_RANGE_PERCENT: number;
  // Delay before attempting to reconnect (in milliseconds)
  RECONNECT_DELAY_MS: number;
  // Number of decimal places for price and quantity
  PRICE_PRECISION: number;
  QUANTITY_PRECISION: number;
}

/**
 * An array of bot configurations.
 * Each object in this array will spawn a new, independent bot instance.
 */
export const botConfigs: BotConfig[] = [
  // --- BOT 1: BTC/USD ---
  {
    name: "BTC Liquidity Bot",
    WEBSOCKET_URL: "ws://localhost:4000",
    TRADING_SYMBOL: "BTC:INR",
    BUYER_USER_ID: "100",
    SELLER_USER_ID: "101",
    MIN_ORDER_SIZE: 0.001,
    MAX_ORDER_SIZE: 0.01,
    ORDER_INTERVAL_MS: 500, // Places orders every 0.5 seconds
    PRICE_RANGE_PERCENT: 0.04, // 98% to 102% of LTP
    RECONNECT_DELAY_MS: 5000,
    PRICE_PRECISION: 2,
    QUANTITY_PRECISION: 5,
  },

  // --- BOT 2: ETH/USD ---
  // (Assuming 'ETH:USD' is an enabled pair on your server)
  {
    name: "ETH Liquidity Bot",
    WEBSOCKET_URL: "ws://localhost:4000",
    TRADING_SYMBOL: "ETH:USD",
    BUYER_USER_ID: "200",
    SELLER_USER_ID: "201",
    MIN_ORDER_SIZE: 0.05,
    MAX_ORDER_SIZE: 0.2,
    ORDER_INTERVAL_MS: 800, // Places orders every 0.8 seconds
    PRICE_RANGE_PERCENT: 0.05, // 97.5% to 102.5% of LTP
    RECONNECT_DELAY_MS: 5000,
    PRICE_PRECISION: 2,
    QUANTITY_PRECISION: 4,
  },

  // Add more bot configurations here...
  // {
  //   name: "SOL Liquidity Bot",
  //   ...
  // },
];
