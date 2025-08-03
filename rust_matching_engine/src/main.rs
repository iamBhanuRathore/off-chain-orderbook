// main.rs
mod consumer;
mod matching_engine;
mod matching_engine_tests;

use consumer::OrderConsumer;
use matching_engine::MatchingEngine;
use serde::Deserialize;
use std::fs;
use std::sync::Arc;
use tokio::sync::Mutex;

const REDIS_URL: &str = "redis://127.0.0.1:6379";
const CONFIG_FILE_PATH: &str = "../markets.json";

#[derive(Deserialize, Debug, Clone)]
struct TradingPairConfig {
    symbol: String,
    base_asset: String,
    quote_asset: String,
    enabled: bool,
    #[allow(dead_code)]
    description: String,
}

#[tokio::main]
async fn main() {
    println!("Starting Matching Engine Application");

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

        let symbol_key_part = format!(
            "{}_{}",
            config.base_asset.to_uppercase(),
            config.quote_asset.to_uppercase()
        );
        let order_queue_name = format!("orderbook:orders:{}", symbol_key_part);
        let trade_queue_name = format!("orderbook:trades:{}", symbol_key_part);
        let cancel_queue_name = format!("orderbook:cancel:{}", symbol_key_part);
        // ** --- These two queues are used to seed the db with the trades/orders happen by the matching engine.
        let processed_orders_queue_name = format!("engine:processed_orders:{}", symbol_key_part);
        let processed_trades_queue_name = format!("engine:processed_trades:{}", symbol_key_part);
        // ** --- These two queues are used to seed the db with the trades/orders happen by the matching engine.
        let ltp_key_name = format!("orderbook:ltp:{}", symbol_key_part);
        let snapshot_key_name = format!("orderbook:snapshot:{}", symbol_key_part);
        let delta_channel_name = format!("orderbook:deltas:{}", symbol_key_part);
        let bids_orderbook_key = format!("orderbook:bids:{}", symbol_key_part);
        let asks_orderbook_key = format!("orderbook:asks:{}", symbol_key_part);
        println!("Initializing consumer for symbol '{}'...", config.symbol);
        println!(" -> Orders Queue:       {}", order_queue_name);
        println!(" -> Cancel Queue:       {}", cancel_queue_name);
        println!(" -> Trades Stream:      {}", trade_queue_name);
        println!(" -> Snapshot Requests:  {}:requests", snapshot_key_name);
        println!(" -> Deltas Channel:     {}", delta_channel_name);
        println!(" -> Redis Bids:         {}", bids_orderbook_key);
        println!(" -> Redis Asks:         {}", asks_orderbook_key);
        println!(
            " -> Processed Orders Queue:   {}",
            processed_orders_queue_name
        );
        println!(
            " -> Processed Trades Queue:   {}",
            processed_trades_queue_name
        );

        let engine = Arc::new(Mutex::new(MatchingEngine::new(config.symbol.clone())));

        let consumer = match OrderConsumer::new(
            REDIS_URL,
            engine,
            config.symbol.clone(),
            order_queue_name.clone(),
            cancel_queue_name.clone(),
            trade_queue_name.clone(),
            processed_trades_queue_name.clone(),
            processed_orders_queue_name.clone(),
            ltp_key_name.clone(),
            snapshot_key_name.clone(),
            delta_channel_name.clone(),
            bids_orderbook_key.clone(),
            asks_orderbook_key.clone(),
        )
        .await
        {
            Ok(c) => c,
            Err(e) => {
                eprintln!("Failed to create consumer for {}: {}", config.symbol, e);
                continue;
            }
        };

        // Initialize Redis orderbook with current state
        consumer.initialize_redis_orderbook().await;

        let handle = tokio::spawn(async move {
            consumer.run_consumer().await;
        });
        consumer_handles.push(handle);
    }

    if consumer_handles.is_empty() {
        println!("No enabled trading pairs found or no consumers could be started. Exiting.");
        return;
    }

    println!("\nAll enabled matching engines are running.");
    println!("\n--- Example Commands for BTC_INR ---");

    println!("\n1. Submit Orders:");
    println!(
        r#"LPUSH orderbook:orders:BTC_INR '{{"command":"NewOrder","payload":{{"user_id":1,"order_type":"Limit","side":"Buy","price":"50000","quantity":"1.5"}}}}'"#
    );
    println!(
        r#"LPUSH orderbook:orders:BTC_INR '{{"command":"NewOrder","payload":{{"user_id":2,"order_type":"Market","side":"Sell","price":"0","quantity":"0.5"}}}}'"#
    );

    println!("\n2. Cancel Orders:");
    println!(
        r#"LPUSH orderbook:cancel:BTC_INR '{{"command":"CancelOrder","payload":{{"order_id":"xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"}}}}'"#
    );

    println!("\n3. Request Snapshot:");
    println!(
        r#"LPUSH orderbook:snapshot:BTC_INR:requests '{{"command":"SnapshotRequest","payload":{{"response_channel":"my_snapshot_channel"}}}}'"#
    );
    println!("SUBSCRIBE my_snapshot_channel");

    println!("\n4. Query Redis Orderbook Directly:");
    println!("# Top 10 bids (highest first):");
    println!("ZREVRANGE orderbook:bids:BTC_INR 0 9 WITHSCORES");
    println!("# Top 10 asks (lowest first):");
    println!("ZRANGE orderbook:asks:BTC_INR 0 9 WITHSCORES");

    println!("\n5. Real-time Updates:");
    println!("SUBSCRIBE orderbook:deltas:BTC_INR");

    println!("\n6. Trade History:");
    println!("LRANGE orderbook:trades:BTC_INR 0 10");

    println!("\n7. Last Traded Price:");
    println!("GET orderbook:ltp:BTC_INR");

    match tokio::signal::ctrl_c().await {
        Ok(()) => println!("\nCtrl+C received, shutting down."),
        Err(err) => eprintln!("Failed to listen for Ctrl+C: {}", err),
    }

    println!("Application shut down.");
}
