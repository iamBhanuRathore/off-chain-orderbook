
use crate::matching_engine::{MatchingEngine, Order}; // Assuming matching_engine is in lib.rs or mod.rs
use redis::{AsyncCommands};// Use AsyncCommands for tokio
use serde_json;
use std::{ sync::Arc}; // For Sharing Matching Engine across task
use tokio::sync::Mutex; // For mutable access to the Matching engine


const ORDER_QUEUE_KEY:&str = "order_key";
// const TRADE_CHANNEL_QUEUE: &str = "trade_events"; // For publishing trade later


pub struct OrderConsumer {
  redis_client: redis::Client,
  engine:Arc<Mutex<MatchingEngine>>
}

impl OrderConsumer {
  pub async fn new(redis_url:&str,engine:Arc<Mutex<MatchingEngine>>)->Result<Self,redis::RedisError>{
    let client =redis::Client::open(redis_url)?;
    Ok(OrderConsumer { redis_client: client, engine: engine })
  }

  pub async fn run_consumer(&self){
    println!("Order consumed started. Waiting for orders on Redis Queue '{}' ...",ORDER_QUEUE_KEY);
    loop {
      let mut con = match self.redis_client.get_multiplexed_async_connection().await {
        Ok(c)=>c,
        Err(e) =>{
          eprintln!("Failed to get redis connection: {}, Retrying in 5s....",e);
          tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
          continue;
        }
      };
      // BRPOP is a blocking pop from a list.
      // The "0" means wait indefinitely.
      // It returns a tuple (list_name, value)
      let result: Result<Option<(String,String)>,redis::RedisError> = con.brpop(ORDER_QUEUE_KEY, 0.0).await;
      match result {
        Ok(Some((_list_name,order_json)))=>{
          match serde_json::from_str::<Order>(&order_json){
            Ok(order)=>{
              let mut engine = self.engine.lock().await;
              let trades = engine.add_order(order);
              if !trades.is_empty(){
                println!("Generated {} trades",trades.len());
                for trade in trades{
                  println!("Trade: TakerId={}, Makerid={}, P={}, Q={}",trade.taker_order_id,trade.maker_order_id,trade.price,trade.quantity);
                  // Publish them to another Redis channel/list
                }
              }
              engine.print_order_book();
            }
            Err(e)=>{
              eprintln!("Failed to deserialize order: {}",e);
            }
          }
        }
        Ok(None)=>{
          // This case should not happen with BRPOP and timeout 0 unless connection drops.
          // It can happen if timeout is non-zero and expires.
          println!("BRPOP returned None (e.g. timeout or connection issue)");
        }
        Err(e)=> {
          eprintln!("Error receiving order from Redis: {}", e);
          // Potentially add a delay before retryingto avoid spamming logs onpersistant connection issues
          tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
        }
      }
    }
  }
}
