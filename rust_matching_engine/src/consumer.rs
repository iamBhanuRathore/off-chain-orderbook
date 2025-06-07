// consumer.rs
use crate::matching_engine::{MatchingEngine, Order};
use redis::AsyncCommands;
use serde_json;
use std::sync::Arc;
use tokio::sync::Mutex; // Use tokio's Mutex for async code

// Removed: const ORDER_QUEUE_KEY:&str = "order_key";

pub struct OrderConsumer {
    redis_client: redis::aio::ConnectionManager,
    engine: Arc<Mutex<MatchingEngine>>,
    order_queue_key: String, // Each consumer listens to a specific queue
}

impl OrderConsumer {
    pub async fn new(
        cloned_redis_client: redis::aio::ConnectionManager,
        engine: Arc<Mutex<MatchingEngine>>,
        order_queue_key: String, // Pass the queue key
    ) -> Result<Self, redis::RedisError> {
        Ok(OrderConsumer {
            redis_client: cloned_redis_client,
            engine,
            order_queue_key,
        })
    }

    pub async fn run_consumer(&self) {
        println!(
            "Order consumer started for queue '{}'. Waiting for orders...",
            self.order_queue_key
        );
        loop {
          let mut con = self.redis_client.clone();

            let result: Result<Option<(String, String)>, redis::RedisError> =
                con.brpop(&self.order_queue_key, 0.0).await; // Use instance's queue key

            match result {
                Ok(Some((_list_name, order_json))) => {
                    match serde_json::from_str::<Order>(&order_json) {
                        Ok(order) => {
                            // Optionally log received order:
                            // println!("[{}] Received order: {:?}", self.order_queue_key, order.id);
                            let mut engine_guard = self.engine.lock().await;
                            let trades = engine_guard.add_order(order);
                            if !trades.is_empty() {
                                println!("[{}] Generated {} trades", self.order_queue_key, trades.len());
                                for trade in trades {
                                    println!(
                                        "[{}] Trade: TakerId={}, MakerId={}, P={}, Q={}",
                                        self.order_queue_key,
                                        trade.taker_order_id,
                                        trade.maker_order_id,
                                        trade.price,
                                        trade.quantity
                                    );
                                    // TODO: Publish trades to a Redis channel/list if needed
                                }
                            }
                            engine_guard.print_order_book(); // Prints order book for its specific symbol
                        }
                        Err(e) => {
                            eprintln!(
                                "[{}] Failed to deserialize order from JSON '{}': {}",
                                self.order_queue_key, order_json, e
                            );
                        }
                    }
                }
                Ok(None) => {
                    // This case should ideally not happen with BRPOP timeout 0,
                    // unless connection drops or other rare scenarios.
                    println!("[{}] BRPOP returned None.", self.order_queue_key);
                }
                Err(e) => {
                    eprintln!(
                        "[{}] Error receiving order from Redis: {}. Retrying in 1s...",
                        self.order_queue_key, e
                    );
                    tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
                }
            }
        }
    }
}
