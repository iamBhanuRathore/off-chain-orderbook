
use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use rust_decimal_macros::dec;
use std::cmp::{Ordering, Reverse};
use std::collections::{BTreeMap, VecDeque};
use uuid::Uuid;

// --- Enums & Structs ---
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, serde::Serialize, serde::Deserialize)]
pub enum OrderSide {
    Buy,
    Sell,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct Order {
    pub id: Uuid,
    pub user_id: u64, // Simplified user ID
    pub side: OrderSide,
    pub price: Decimal,
    pub quantity: Decimal,
    pub timestamp: DateTime<Utc>,
    // Add other fields like order_type (Limit, Market) in the future
}

impl Order {
    pub fn new(user_id: u64, side: OrderSide, price: Decimal, quantity: Decimal) -> Self {
        Order {
            id: Uuid::new_v4(),
            user_id,
            side,
            price,
            quantity,
            timestamp: Utc::now(),
        }
    }
}

// For sorting orders at the same price level (time priority)
impl Ord for Order {
    fn cmp(&self, other: &Self) -> Ordering {
        self.timestamp.cmp(&other.timestamp)
    }
}

impl PartialOrd for Order {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

impl PartialEq for Order {
    fn eq(&self, other: &Self) -> bool {
        self.id == other.id // ID is unique
    }
}

impl Eq for Order {}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct Trade {
    pub id: Uuid,
    pub taker_order_id: Uuid,
    pub maker_order_id: Uuid,
    pub price: Decimal,
    pub quantity: Decimal,
    pub timestamp: DateTime<Utc>,
    // Could add buyer_user_id, seller_user_id
}
impl Trade {
    pub fn new(
        taker_order_id: Uuid,
        maker_order_id: Uuid,
        price: Decimal,
        quantity: Decimal,
    ) -> Self {
        Trade {
            id: Uuid::new_v4(),
            taker_order_id,
            maker_order_id,
            price,
            quantity,
            timestamp: Utc::now(),
        }
    }
}

// --- Matching Engine ---
pub struct MatchingEngine {
    // Bids: Highest Prices first. BTreeMap sorts keys ascending, so use 'std::cmp::reverse' for price.
    // At each level, orders are stored in a VeDeque for FIFO (time priority).
    bids: BTreeMap<std::cmp::Reverse<Decimal>, VecDeque<Order>>,
    // Asks: Lowest Prices first.
    asks: BTreeMap<Decimal, VecDeque<Order>>,
    // Simple sequence for trade IDs or other internal tracking if needed
    // For order cancellation, you might need a HashMap<Uuid, (OrderSide, Decimal)> to quickly find orders
    order_map: std::collections::HashMap<Uuid, (OrderSide, Decimal, DateTime<Utc>)>,
}

// ? How they would look
// Asks
// Map(2) {
//   '100.50' => [
//     {
//       id: 'd290f1ee-6c54-4b01-90e6-d701748f0851',
//       userId: 1,
//       side: 'Buy',
//       price: '100.50',
//       quantity: '2.0',
//       timestamp: 2025-05-29T15:45:30.123Z
//     }
//   ],
//   '101.00' => [
//     {
//       id: 'a1b2c3d4-5e6f-7g8h-9i0j-k1l2m3n4o5p6',
//       userId: 2,
//       side: 'Buy',
//       price: '101.00',
//       quantity: '1.5',
//       timestamp: 2025-05-29T15:46:00.321Z
//     }
//   ]
// }

// ? Bids
// Map(2) {
//   '99.50' => [
//     {
//       id: 'd290f1ee-6c54-4b01-90e6-d701748f0851',
//       userId: 1,
//       side: 'Sell',
//       price: '99.50',
//       quantity: '2.0',
//       timestamp: 2025-05-29T15:45:30.123Z
//     }
//   ],
//   '99.00' => [
//     {
//       id: 'a1b2c3d4-5e6f-7g8h-9i0j-k1l2m3n4o5p6',
//       userId: 2,
//       side: 'Sell',
//       price: '99.00',
//       quantity: '1.5',
//       timestamp: 2025-05-29T15:46:00.321Z
//     }
//   ]
// }
// ? Order Map
// Map(2) {
//   'd290f1ee-6c54-4b01-90e6-d701748f0851' => {
//     side: 'Buy',
//     price: '100.50',
//     timestamp: 2025-05-29T15:45:30.123Z
//   },
//   'a1b2c3d4-5e6f-7g8h-9i0j-k1l2m3n4o5p6' => {
//     side: 'Buy',
//     price: '101.00',
//     timestamp: 2025-05-29T15:46:00.321Z
//   }
// }

impl MatchingEngine {
    pub fn new() -> Self {
        MatchingEngine {
            bids: BTreeMap::new(),
            asks: BTreeMap::new(),
            order_map: std::collections::HashMap::new(),
        }
    }
    pub fn add_order(&mut self, mut order: Order) -> Vec<Trade> {
        let mut trades = Vec::new();
        // Store order for cancellation lookup
        self.order_map
            .insert(order.id, (order.side, order.price, order.timestamp));

        match order.side {
            OrderSide::Buy => {
                // Try to match with existing asks
                let mut asks_to_remove = Vec::new(); // Price levels that become empty

                for (ask_price, orders_at_price) in self.asks.iter_mut() {
                    if order.price >= *ask_price {
                        // Buy price is high enough to match
                        let mut orders_to_remove_from_level = Vec::new(); // Indices of orders within VecDeque

                        for (idx, maker_order) in orders_at_price.iter_mut().enumerate() {
                            if order.quantity == dec!(0) {
                                break;
                            } // Taker order fully filled

                            let trade_quantity = order.quantity.min(maker_order.quantity);
                            let trade_price = maker_order.price; // Match at maker's price (ask price)

                            trades.push(Trade::new(
                                order.id,
                                maker_order.id,
                                trade_price,
                                trade_quantity,
                            ));

                            order.quantity -= trade_quantity;
                            maker_order.quantity -= trade_quantity;

                            if maker_order.quantity == dec!(0) {
                                orders_to_remove_from_level.push(idx);
                                self.order_map.remove(&maker_order.id); // Remove from cancellation map
                            }
                        }

                        // Remove filled maker orders from this price level (iterate in reverse to keep indices valid)
                        for idx in orders_to_remove_from_level.iter().rev() {
                            orders_at_price.remove(*idx);
                        }

                        if orders_at_price.is_empty() {
                            asks_to_remove.push(*ask_price);
                        }
                        if order.quantity == dec!(0) {
                            break;
                        } // Taker order fully filled
                    } else {
                        // Buy price is too low, no more matches possible on asks side
                        break;
                    }
                }

                for price in asks_to_remove {
                    self.asks.remove(&price);
                }

                // If buy order still has quantity, add it to bids
                if order.quantity > dec!(0) {
                    self.bids
                        .entry(std::cmp::Reverse(order.price))
                        .or_default()
                        .push_back(order);
                } else {
                    // Taker order fully filled, remove from order_map
                    self.order_map.remove(&order.id);
                };
            }
            OrderSide::Sell => {
                // Try to match with existing bids
                let mut bids_to_remove = Vec::new(); // Price levels that become empty
                for (bid_price_rev, orders_at_price) in self.bids.iter_mut() {
                    let bid_price = bid_price_rev.0; // Get actual Decimal price
                    if order.price <= bid_price { // Sell price is low enough to match
                        let mut orders_to_remove_from_level = Vec::new();

                        for (idx, maker_order) in orders_at_price.iter_mut().enumerate() {
                            if order.quantity == dec!(0) { break; }

                            let trade_quantity = order.quantity.min(maker_order.quantity);
                            let trade_price = maker_order.price; // Match at maker's price (bid price)

                            trades.push(Trade::new(order.id, maker_order.id, trade_price, trade_quantity));

                            order.quantity -= trade_quantity;
                            maker_order.quantity -= trade_quantity;

                            if maker_order.quantity == dec!(0) {
                                orders_to_remove_from_level.push(idx);
                                self.order_map.remove(&maker_order.id);
                            }
                        }

                        for idx in orders_to_remove_from_level.iter().rev() {
                            orders_at_price.remove(*idx);
                        }

                        if orders_at_price.is_empty() {
                            bids_to_remove.push(*bid_price_rev);
                        }
                        if order.quantity == dec!(0) { break; }
                    } else {
                        // Sell price is too high, no more matches possible on bids side
                        break;
                    }
                }
                for price_rev in bids_to_remove {
                    self.bids.remove(&price_rev);
                }

                // If sell order still has quantity, add it to asks
                if order.quantity > dec!(0) {
                    self.asks
                        .entry(order.price)
                        .or_default()
                        .push_back(order);
                } else {
                     self.order_map.remove(&order.id);
                }
            }
        }
        return trades;
    }
    pub fn cancel_order(&mut self,order_id:Uuid)->Result<Order,String>{
        if let Some((side,price,_timestamp)) = self.order_map.remove(&order_id){
        match side {
            OrderSide::Buy => {
                if let Some(orders_at_price) = self.bids.get_mut(&std::cmp::Reverse(price)) {
                    if let Some(pos) = orders_at_price.iter().position(|o| o.id == order_id) {
                        let removed_order = orders_at_price.remove(pos).unwrap(); // Should exist
                        if orders_at_price.is_empty() {
                            self.bids.remove(&std::cmp::Reverse(price));
                        }
                        return Ok(removed_order);
                    }
                }
            }
            OrderSide::Sell => {
                if let Some(orders_at_price) = self.asks.get_mut(&price) {
                    if let Some(pos) = orders_at_price.iter().position(|o| o.id == order_id) {
                        let removed_order = orders_at_price.remove(pos).unwrap(); // Should exist
                        if orders_at_price.is_empty() {
                            self.asks.remove(&price);
                        }
                        return Ok(removed_order);
                    }
                }
            }
        }
        // If we get here, order was in map but not in book (should not happen if map is consistent)
        Err(format!("Order {} was in the map but not in  book. Inconsistent state",order_id))
        } else {
            Err(format!("Order {} was not found for cancellation",order_id))
        }
    }
    // ---- Helper methond to inspect the order book ----
    pub fn get_bids(&self)-> &BTreeMap<Reverse<Decimal>, VecDeque<Order>>{
        return  &self.bids;
    }
    pub fn _get_asks(&self) -> &BTreeMap<Decimal, VecDeque<Order>> {
        return  &self.asks;
    }
    pub fn print_order_book(&self){
        println!("\n--- ORDER BOOK ----");
        println!("Asks (Price | Quantity | Order):");
        for (price, orders) in &self.asks {
            let total_quantity: Decimal = orders.iter().map(|o| o.quantity).sum();
            println!("  {} | {} | {}", price, total_quantity, orders.len());
        }
        println!("------------------");
        // Bids (highest price first)
        for (price_rev, orders) in self.bids.iter() {
            let total_quantity: Decimal = orders.iter().map(|o| o.quantity).sum();
            println!("  {} | {} | {}", price_rev.0, total_quantity, orders.len());
        }
        println!("------------------\n");
    }
}
