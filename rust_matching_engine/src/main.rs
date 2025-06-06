mod matching_engine;
mod consumer;
use matching_engine::{MatchingEngine, Order, OrderSide};
use rust_decimal_macros::dec;
use uuid::Uuid; // For easily creating Decimals
use std::sync::{Arc, Mutex};
use tokio::sync::Mutex;

use crate::consumer::OrderConsumer;

const REDIS_URL: &str = "redis://localhost:6379"; //redis://127.0.0.1/

#[tokio::main]

async fn main (){
  println!("Starting Matching Engine Application");
  // create the matching engine instance, wrapped for safe sharing;
  let engine = Arc::new(Mutex::new(MatchingEngine::new()));
  // Clone Arc for the consumer task
  let engine_clone_for_consumer = Arc::clone(&engine);

  // create and run order consumer
  let consumer = match OrderConsumer::new(REDIS_URL, engine_clone_for_consumer).await {
    Ok(consumer) => consumer,
    Err(err) => {
        eprintln!("Failed to create order consumer: {}", err);
        return;
    }
  };
  // Spawn the consumer in a separate Tokio task so it doesn't block main
  tokio::spawn(async move {
    consumer.run().await;
  });
  // --- Keep the main thread alive (e.g., for other tasks or graceful shutdown) ---
  // For this example, we'll just let it run until Ctrl+C
  // In a real app, you might have an API server here, or a signal handler for shutdown
  println!("Matching engine core is running. Order consumer is listening.");
  println!("Push orders to Redis list '{}' (e.g., using redis-cli LPUSH).", redis_consumer::ORDER_QUEUE_KEY); // Use const from module
  println!("Example JSON order (ensure Decimal fields are strings for serde_json):");
  println!(r#"LPUSH order_queue '{{"user_id":1,"side":"Buy","price":"100.0","quantity":"10"}}'"#);

  // Keep main alive, e.g. by waiting for a signal
  match tokio::signal::ctrl_c().await {
    Ok(()) =>{
      println!("Ctrl+C received, shutting down.");
    },
    Err(err) => {
      eprintln!("Failed to listen for Ctrl+C: {}", err);
    },
  }
}
