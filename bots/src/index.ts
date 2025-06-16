// src/index.ts

import { botConfigs } from "./bots.config";
import { LiquidityProviderBot } from "./LiquidityProviderBot";

/**
 * Main function to launch all configured bots.
 */
function launchBots() {
  console.log(`--- Multi-Bot Initializing ---`);

  if (!botConfigs || botConfigs.length === 0) {
    console.error("No bot configurations found in 'bots.config.ts'. Exiting.");
    return;
  }

  console.log(`Found ${botConfigs.length} bot configuration(s). Launching...`);
  console.log("-----------------------------------------");

  // Iterate over each configuration and create a new bot instance
  botConfigs.forEach((config) => {
    try {
      console.log(`\n=> Launching bot: ${config.name} for pair ${config.TRADING_SYMBOL}`);
      new LiquidityProviderBot(config);
    } catch (error) {
      console.error(`Failed to launch bot ${config.name}. Error:`, error);
    }
  });

  console.log("\n-----------------------------------------");
  console.log("All bots have been launched.");
}

// Start the application
launchBots();

// Graceful shutdown logic
const shutdown = () => {
  console.log("\n--- Received shutdown signal. Terminating all bots. ---");
  process.exit(0);
};

process.on("SIGINT", shutdown); // Catches Ctrl+C
process.on("SIGTERM", shutdown); // Catches kill signals
