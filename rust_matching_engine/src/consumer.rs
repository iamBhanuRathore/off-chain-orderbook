// consumer.rs
use crate::matching_engine::{MatchingEngine, Order, Trade, OrderBookDelta, DeltaAction, OrderSide};
use redis::{AsyncCommands, pipe};
use serde::Deserialize;
use serde_json;
use std::sync::Arc;
use tokio::sync::Mutex;
use uuid::Uuid;
use rust_decimal::prelude::ToPrimitive;

#[derive(Deserialize, Debug)]
#[serde(tag = "command", content = "payload", rename_all = "PascalCase")]
enum EngineCommand {
    NewOrder(Order),
    CancelOrder { order_id: Uuid },
    SnapshotRequest { response_channel: String },
}

pub struct OrderConsumer {
    redis_client: redis::aio::ConnectionManager,
    engine: Arc<Mutex<MatchingEngine>>,
    symbol: String,
    order_queue_key: String,
    cancel_queue_key: String,
    snapshot_request_queue_key: String,
    trade_queue_key: String,
    ltp_key: String,
    delta_channel_key: String,
    bids_orderbook_key: String,
    asks_orderbook_key: String,
}

impl OrderConsumer {
    #[allow(clippy::too_many_arguments)]
    pub async fn new(
        redis_url: &str,
        engine: Arc<Mutex<MatchingEngine>>,
        symbol: String,
        order_queue_key: String,
        cancel_queue_key: String,
        trade_queue_key: String,
        ltp_key: String,
        snapshot_key: String, // We'll use this for snapshot requests
        delta_channel_key: String,
        bids_orderbook_key:String,
        asks_orderbook_key:String
    ) -> Result<Self, redis::RedisError> {
        let redis_client = redis::Client::open(redis_url)?;
        let connection_manager = redis::aio::ConnectionManager::new(redis_client).await?;

        // Extract symbol from keys for Redis native storage
        let symbol_part = symbol.clone();
        let snapshot_request_queue_key = format!("{}:requests", snapshot_key);

        Ok(OrderConsumer {
            redis_client: connection_manager,
            engine,
            symbol: symbol_part,
            order_queue_key,
            cancel_queue_key,
            snapshot_request_queue_key,
            trade_queue_key,
            ltp_key,
            delta_channel_key,
            bids_orderbook_key,
            asks_orderbook_key,
        })
    }

    async fn publish_deltas(&self, deltas: Vec<OrderBookDelta>) {
        if deltas.is_empty() { return; }

        let mut con = self.redis_client.clone();
        for delta in deltas {
            if let Ok(delta_json) = serde_json::to_string(&delta) {
                // PUBLISH is a fire-and-forget broadcast
                let _: Result<(), _> = con.publish(&self.delta_channel_key, delta_json).await;
            }
        }
    }

    async fn update_redis_orderbook(&self, deltas: &[OrderBookDelta]) {
        if deltas.is_empty() { return; }

        let mut con = self.redis_client.clone();

        for delta in deltas {
            let key = match delta.side {
                OrderSide::Buy => &self.bids_orderbook_key,
                OrderSide::Sell => &self.asks_orderbook_key,
            };
            let score = if delta.side == OrderSide::Buy {
                       -delta.price.to_f64().unwrap_or(0.0)
                   } else {
                       delta.price.to_f64().unwrap_or(0.0)
                   };
            let _: Result<i32, _> = con.zrembyscore(key, score, score).await;
            match delta.action {
                DeltaAction::Delete => {
                  // Nothing more to do - entry already removed
                }
                DeltaAction::New | DeltaAction::Update => {
                    // Score is the price (for sorting), member is price:quantity
                    let member = format!("{}:{}", delta.price, delta.new_quantity);
                    // Add new entry
                    let _: Result<i32, _> = con.zadd(key, member, score).await;
                }
            }
        }
    }

    async fn publish_trades_and_ltp(&self, trades: Vec<Trade>) {
        if trades.is_empty() { return; }

        let mut con = self.redis_client.clone();

        // Publish trades
        let mut trade_pipeline = pipe();
        for trade in &trades {
            if let Ok(trade_json) = serde_json::to_string(trade) {
                trade_pipeline.lpush(&self.trade_queue_key, trade_json);
            }
        }
        let _: Result<(), _> = trade_pipeline.query_async(&mut con).await;

        // Update LTP
        if let Some(last_trade) = trades.last() {
            let _: Result<(), _> = con.set(&self.ltp_key, last_trade.price.to_string()).await;
        }
    }

    async fn handle_snapshot_request(&self, response_channel: String) {
        println!("[{}] Generating snapshot for channel: {}", self.symbol, response_channel);

        let engine_guard = self.engine.lock().await;
        let snapshot = engine_guard.get_order_book_snapshot();
        drop(engine_guard);

        if let Ok(snapshot_json) = serde_json::to_string(&snapshot) {
            let mut con = self.redis_client.clone();
            let _: Result<(), _> = con.publish(&response_channel, snapshot_json).await;
            println!("[{}] Snapshot sent to channel: {}", self.symbol, response_channel);
        } else {
            eprintln!("[{}] Failed to serialize snapshot for channel: {}", self.symbol, response_channel);
        }
    }

    pub async fn run_consumer(&self) {
        println!("[{}] Consumer started. Listening for orders, cancellations, and snapshot requests...", self.symbol);
        let queues = vec![
            self.order_queue_key.as_str(),
            self.cancel_queue_key.as_str(),
            self.snapshot_request_queue_key.as_str(),
        ];

        loop {
            let mut con = self.redis_client.clone();
            let result: Result<Option<(String, String)>, redis::RedisError> = con.brpop(&queues, 0.0).await;

            match result {
                Ok(Some((queue, data_json))) => {
                    println!("[{}] Received command from queue '{}'", self.symbol, queue);

                    if queue == self.snapshot_request_queue_key {
                        // Handle snapshot request separately
                        if let Ok(snapshot_request) = serde_json::from_str::<EngineCommand>(&data_json) {
                            if let EngineCommand::SnapshotRequest { response_channel } = snapshot_request {
                                self.handle_snapshot_request(response_channel).await;
                            }
                        }
                        continue;
                    }

                    match serde_json::from_str::<EngineCommand>(&data_json) {
                        Ok(command) => {
                            let (trades, deltas);
                            let mut engine_guard = self.engine.lock().await;

                            match command {
                                EngineCommand::NewOrder(order) => {
                                    println!("[{}] Processing NewOrder {}", self.symbol, order.id);
                                    (trades, deltas) = engine_guard.add_order(order);
                                }
                                EngineCommand::CancelOrder { order_id } => {
                                    println!("[{}] Processing CancelOrder {}", self.symbol, order_id);
                                    let (result, cancel_deltas) = engine_guard.cancel_order(order_id);
                                    if let Err(e) = result {
                                        eprintln!("[{}] {}", self.symbol, e);
                                    }
                                    trades = Vec::new();
                                    deltas = cancel_deltas;
                                }
                                EngineCommand::SnapshotRequest { .. } => {
                                    // This shouldn't happen here, but handle gracefully
                                    trades = Vec::new();
                                    deltas = Vec::new();
                                }
                            }

                            drop(engine_guard);

                            // Publish results in parallel
                            tokio::join!(
                                self.publish_deltas(deltas.clone()),
                                self.update_redis_orderbook(&deltas),
                                self.publish_trades_and_ltp(trades)
                            );

                            println!("[{}] Command processed.", self.symbol);
                        }
                        Err(e) => {
                            eprintln!("[{}] Failed to deserialize command from JSON '{}': {}", self.symbol, data_json, e);
                        }
                    }
                }
                Ok(None) => continue, // Should not happen with 0.0 timeout
                Err(e) => {
                    eprintln!("[{}] Error from Redis: {}. Retrying in 2s...", self.symbol, e);
                    tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
                }
            }
        }
    }

    // Helper method to initialize the Redis orderbook on startup
    pub async fn initialize_redis_orderbook(&self) {
        let mut con = self.redis_client.clone();

        // Clear existing orderbook data
        let _: Result<(), _> = con.del(&[&self.bids_orderbook_key, &self.asks_orderbook_key]).await;

        // Get initial snapshot and populate Redis
        let engine_guard = self.engine.lock().await;
        let snapshot = engine_guard.get_order_book_snapshot();
        drop(engine_guard);

        // Populate bids
        if !snapshot.bids.is_empty() {
            for bid in &snapshot.bids {
                let member = format!("{}:{}", bid.price, bid.quantity);
                let score = -bid.price.to_f64().unwrap_or(0.0); // Negative for descending order
                let _: Result<i32, _> = con.zadd(&self.bids_orderbook_key, member, score).await;
            }
        }

        // Populate asks
        if !snapshot.asks.is_empty() {
            for ask in &snapshot.asks {
                let member = format!("{}:{}", ask.price, ask.quantity);
                let score = ask.price.to_f64().unwrap_or(0.0); // Positive for ascending order
                let _: Result<i32, _> = con.zadd(&self.asks_orderbook_key, member, score).await;
            }
        }

        println!("[{}] Redis orderbook initialized with {} bids and {} asks",
                 self.symbol, snapshot.bids.len(), snapshot.asks.len());
    }
}

/*
Usage Examples:

1. Request a snapshot (from any client):
   LPUSH orderbook:snapshot:BTC_INR:requests '{"command":"SnapshotRequest","payload":{"response_channel":"snapshot_response_123"}}'

   Then listen for the response:
   SUBSCRIBE snapshot_response_123

2. Query Redis orderbook directly:
   # Get top 10 bids (highest prices first)
   ZREVRANGE orderbook:bids:BTC_INR 0 9 WITHSCORES

   # Get top 10 asks (lowest prices first)
   ZRANGE orderbook:asks:BTC_INR 0 9 WITHSCORES

   # Get all bids above 45000
   ZREVRANGEBYSCORE orderbook:bids:BTC_INR -45000 -inf WITHSCORES

3. Subscribe to real-time deltas (unchanged):
   SUBSCRIBE orderbook:deltas:BTC_INR

4. Get recent trades (unchanged):
   LRANGE orderbook:trades:BTC_INR 0 10

5. Get last traded price (unchanged):
   GET orderbook:ltp:BTC_INR
*/
