// matching_engine.rs
use chrono::{DateTime, Utc,};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
// use rust_decimal_macros::dec; // Not strictly needed in this file if dec! macro not used here
use std::cmp::{Ordering, Reverse};
use std::collections::{BTreeMap, VecDeque, HashMap};
use uuid::Uuid;

// --- Enums & Structs ---
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum OrderSide {
    Buy,
    Sell,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Order {
    #[serde(default = "Uuid::new_v4")] // Default if not in JSON
    pub id: Uuid,
    pub user_id: u64,
    pub side: OrderSide,
    #[serde(with = "rust_decimal::serde::str")] // Deserialize from/Serialize to string
    pub price: Decimal,
    #[serde(with = "rust_decimal::serde::str")] // Deserialize from/Serialize to string
    pub quantity: Decimal,
    #[serde(default = "Utc::now")] // Default if not in JSON
    pub timestamp: DateTime<Utc>,
}

impl Order {
    // This constructor is still useful for programmatic creation or tests
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
        self.id == other.id
    }
}

impl Eq for Order {}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Trade {
    pub id: Uuid,
    pub taker_order_id: Uuid,
    pub maker_order_id: Uuid,
    #[serde(with = "rust_decimal::serde::str")] // Deserialize from/Serialize to string
    pub price: Decimal,
    #[serde(with = "rust_decimal::serde::str")] // Deserialize from/Serialize to string
    pub quantity: Decimal,
    pub timestamp: DateTime<Utc>,
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
    symbol: String, // Added symbol field
    bids: BTreeMap<Reverse<Decimal>, VecDeque<Order>>,
    asks: BTreeMap<Decimal, VecDeque<Order>>,
    order_map: HashMap<Uuid, (OrderSide, Decimal, DateTime<Utc>)>,
}

impl MatchingEngine {
    pub fn new(symbol: String) -> Self { // Accept symbol
        MatchingEngine {
            symbol, // Store symbol
            bids: BTreeMap::new(),
            asks: BTreeMap::new(),
            order_map: HashMap::new(),
        }
    }

    pub fn add_order(&mut self, mut order: Order) -> Vec<Trade> {
        let mut trades = Vec::new();
        // Store order for cancellation lookup, only if it's not a market order that fills immediately
        // For limit orders, it's always added to order_map if it's not fully filled immediately.
        // If order quantity is > 0 after matching attempts, it's added to book, so it should be in order_map.
        // If order is fully filled as taker, it should be removed from order_map.
        // The logic for adding to order_map when order is placed and removing when filled/cancelled needs to be consistent.

        // Current logic: add to map first. If fully filled as taker, remove.
        self.order_map
            .insert(order.id, (order.side, order.price, order.timestamp));

        // Using rust_decimal_macros::dec for 0 comparison for clarity
        use rust_decimal_macros::dec;

        match order.side {
            OrderSide::Buy => {
                let mut asks_to_remove = Vec::new();

                for (ask_price, orders_at_price) in self.asks.iter_mut() {
                    if order.price >= *ask_price {
                        let mut orders_to_remove_from_level = Vec::new();
                        for (idx, maker_order) in orders_at_price.iter_mut().enumerate() {
                            if order.quantity == dec!(0) {
                                break;
                            }

                            let trade_quantity = order.quantity.min(maker_order.quantity);
                            let trade_price = maker_order.price;

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
                                self.order_map.remove(&maker_order.id);
                            }
                        }

                        for idx in orders_to_remove_from_level.iter().rev() {
                            orders_at_price.remove(*idx);
                        }

                        if orders_at_price.is_empty() {
                            asks_to_remove.push(*ask_price);
                        }
                        if order.quantity == dec!(0) {
                            break;
                        }
                    } else {
                        break;
                    }
                }

                for price in asks_to_remove {
                    self.asks.remove(&price);
                }

                if order.quantity > dec!(0) {
                    self.bids
                        .entry(Reverse(order.price))
                        .or_default()
                        .push_back(order);
                } else {
                    self.order_map.remove(&order.id); // Fully filled as taker
                }
            }
            OrderSide::Sell => {
                let mut bids_to_remove = Vec::new();
                for (bid_price_rev, orders_at_price) in self.bids.iter_mut() {
                    let bid_price = bid_price_rev.0;
                    if order.price <= bid_price {
                        let mut orders_to_remove_from_level = Vec::new();
                        for (idx, maker_order) in orders_at_price.iter_mut().enumerate() {
                            if order.quantity == dec!(0) {
                                break;
                            }

                            let trade_quantity = order.quantity.min(maker_order.quantity);
                            let trade_price = maker_order.price;

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
                        if order.quantity == dec!(0) {
                            break;
                        }
                    } else {
                        break;
                    }
                }
                for price_rev in bids_to_remove {
                    self.bids.remove(&price_rev);
                }

                if order.quantity > dec!(0) {
                    self.asks
                        .entry(order.price)
                        .or_default()
                        .push_back(order);
                } else {
                    self.order_map.remove(&order.id); // Fully filled as taker
                }
            }
        }
        trades
    }

    pub fn cancel_order(&mut self, order_id: Uuid) -> Result<Order, String> {
        if let Some((side, price, _timestamp)) = self.order_map.remove(&order_id) {
            match side {
                OrderSide::Buy => {
                    if let Some(orders_at_price) = self.bids.get_mut(&Reverse(price)) {
                        if let Some(pos) = orders_at_price.iter().position(|o| o.id == order_id) {
                            let removed_order = orders_at_price.remove(pos).unwrap();
                            if orders_at_price.is_empty() {
                                self.bids.remove(&Reverse(price));
                            }
                            return Ok(removed_order);
                        }
                    }
                }
                OrderSide::Sell => {
                    if let Some(orders_at_price) = self.asks.get_mut(&price) {
                        if let Some(pos) = orders_at_price.iter().position(|o| o.id == order_id) {
                            let removed_order = orders_at_price.remove(pos).unwrap();
                            if orders_at_price.is_empty() {
                                self.asks.remove(&price);
                            }
                            return Ok(removed_order);
                        }
                    }
                }
            }
            Err(format!(
                "Order {} (Symbol: {}) was in map but not in book. Inconsistent state.",
                order_id, self.symbol
            ))
        } else {
            Err(format!(
                "Order {} (Symbol: {}) not found for cancellation.",
                order_id, self.symbol
            ))
        }
    }

    pub fn get_bids(&self) -> &BTreeMap<Reverse<Decimal>, VecDeque<Order>> {
        &self.bids
    }

    pub fn _get_asks(&self) -> &BTreeMap<Decimal, VecDeque<Order>> {
        &self.asks
    }

    pub fn print_order_book(&self) {
        println!("\n--- ORDER BOOK for {} ----", self.symbol); // Use symbol
        println!("Asks (Price | Total Quantity | Orders Count):");
        for (price, orders) in &self.asks {
            let total_quantity: Decimal = orders.iter().map(|o| o.quantity).sum();
            println!("  {} | {} | {}", price, total_quantity, orders.len());
        }
        println!("------------------");
        println!("Bids (Price | Total Quantity | Orders Count):");
        for (price_rev, orders) in self.bids.iter().rev() { // .rev() to print bids from high to low
            let total_quantity: Decimal = orders.iter().map(|o| o.quantity).sum();
            println!("  {} | {} | {}", price_rev.0, total_quantity, orders.len());
        }
        println!("------------------\n");
    }
}
