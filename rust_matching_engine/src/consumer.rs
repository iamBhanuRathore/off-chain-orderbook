// consumer.rs
use crate::matching_engine::{MatchingEngine, Order};
use redis::AsyncCommands;
use serde_json;
use std::sync::Arc;
use tokio::sync::Mutex; // Use tokio's Mutex for async code

pub struct OrderConsumer {
    redis_client: redis::aio::ConnectionManager,
    engine: Arc<Mutex<MatchingEngine>>,
    order_queue_key: String, // Each consumer listens to a specific queue
}

impl OrderConsumer {
    pub async fn new(
        redis_url: &str,
        engine: Arc<Mutex<MatchingEngine>>,
        order_queue_key: String,
    ) -> Result<Self, redis::RedisError> {
        // Create a fresh Redis connection for this consumer
        let redis_client = redis::Client::open(redis_url)?;
        let connection_manager = redis::aio::ConnectionManager::new(redis_client).await?;

        Ok(OrderConsumer {
            redis_client: connection_manager,
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
            println!("[{}] Attempting BRPOP ...", self.order_queue_key);

            // Create a fresh connection for each BRPOP to avoid connection issues
            let mut con = self.redis_client.clone();
            let result: Result<Option<(String, String)>, redis::RedisError> =
                con.brpop(&self.order_queue_key, 0.0).await; // 5 second timeout instead of 0 (infinite)

            match result {
                Ok(Some((list_name, order_json))) => {
                    println!("[{}] BRPOP successful. List: '{}', JSON: '{}'",
                        self.order_queue_key, list_name, order_json);

                    match serde_json::from_str::<Order>(&order_json) {
                        Ok(order) => {
                            println!("[{}] Processing order: {:?}", self.order_queue_key, order.id);
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
                                }
                            } else {
                                println!("[{}] Order added to book, no trades generated", self.order_queue_key);
                            }

                            engine_guard.print_order_book();
                            drop(engine_guard); // Explicitly release the lock

                            println!("[{}] Order processing complete, continuing loop...", self.order_queue_key);
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
                    // Timeout occurred, continue the loop
                    println!("[{}] BRPOP timeout, checking for more orders...", self.order_queue_key);
                }
                Err(e) => {
                    eprintln!(
                        "[{}] Error receiving order from Redis: {}. Retrying in 2s...",
                        self.order_queue_key, e
                    );
                    tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
                }
            }
        }
    }
}
