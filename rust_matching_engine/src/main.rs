// main.rs
mod matching_engine;
mod consumer;

use matching_engine::{MatchingEngine};
use consumer::OrderConsumer;

use serde::Deserialize; // For deserializing the config
use std::fs;
use std::sync::Arc;
use tokio::sync::Mutex; // Ensure using tokio's Mutex for async operations

const REDIS_URL: &str = "redis://127.0.0.1:6379";
const CONFIG_FILE_PATH: &str = "../markets.json";

#[derive(Deserialize, Debug, Clone)]
struct TradingPairConfig {
    symbol: String,
    base_asset: String,
    quote_asset: String,
    enabled: bool,
    #[allow(dead_code)] // description might not be used yet
    description: String,
}

#[tokio::main]
async fn main() {
    println!("Starting Matching Engine Application");

    // Load trading pair configurations
    let config_content = match fs::read_to_string(CONFIG_FILE_PATH) {
        Ok(content) => content,
        Err(e) => {
            eprintln!("Failed to read config file '{}': {}", CONFIG_FILE_PATH, e);
            return;
        }
    };

    let trading_pair_configs: Vec<TradingPairConfig> = match serde_json::from_str(&config_content) {
        Ok(configs) => configs,
        Err(e) => {
            eprintln!("Failed to parse config file '{}': {}", CONFIG_FILE_PATH, e);
            return;
        }
    };

    let mut consumer_handles = Vec::new();

    for config in trading_pair_configs {
        if !config.enabled {
            println!("Skipping disabled trading pair: {}", config.symbol);
            continue;
        }

        // Generate Redis queue name: "orderbook:orders:BASE_QUOTE"
        let queue_name = format!("orderbook:orders:{}_{}", config.base_asset.to_uppercase(), config.quote_asset.to_uppercase());

        println!(
            "Initializing consumer for symbol '{}' on Redis queue '{}'",
            config.symbol, queue_name
        );

        // Create a dedicated matching engine for this symbol
        let engine = Arc::new(Mutex::new(MatchingEngine::new(config.symbol.clone())));

        // Create a fresh Redis connection for each consumer
        let consumer = match OrderConsumer::new(REDIS_URL, engine, queue_name.clone()).await {
            Ok(consumer) => consumer,
            Err(err) => {
                eprintln!(
                    "Failed to create order consumer for symbol '{}' (queue {}): {}",
                    config.symbol, queue_name, err
                );
                continue; // Skip this consumer and try the next one
            }
        };

        let handle = tokio::spawn(async move {
            // Consumer's run method is an infinite loop
            consumer.run_consumer().await;
        });
        consumer_handles.push(handle);
    }

    if consumer_handles.is_empty() {
        println!("No enabled trading pairs found or no consumers could be started. Exiting.");
        return;
    }

    println!("All enabled matching engines are running. Consumers are listening on their respective queues.");
    println!("Push orders to Redis lists, e.g., for BTC/INR (if configured as BTC_INR):");
    println!(r#"LPUSH orderbook:orders:BTC_INR '{{"user_id":1,"side":"Buy","price":"100.0","quantity":"10"}}'"#);
    println!("Ensure Decimal fields (price, quantity) in JSON orders are strings.");

    // Keep main alive, e.g. by waiting for a signal
    match tokio::signal::ctrl_c().await {
        Ok(()) => {
            println!("Ctrl+C received, shutting down application.");
            // Add graceful shutdown logic here if needed (e.g., signal consumers to stop)
        }
        Err(err) => {
            eprintln!("Failed to listen for Ctrl+C: {}", err);
        }
    }

    // For a truly graceful shutdown, you would signal all spawned tasks to terminate
    // and then .await their JoinHandles. For now, Ctrl+C will terminate the process.
    println!("Application shut down.");
}
