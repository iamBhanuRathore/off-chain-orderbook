// matching_engine.rs - FIXED VERSION
use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
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
    #[serde(default = "Uuid::new_v4")]
    pub id: Uuid,
    pub user_id: u64,
    pub side: OrderSide,
    #[serde(with = "rust_decimal::serde::str")]
    pub price: Decimal,
    #[serde(with = "rust_decimal::serde::str")]
    pub quantity: Decimal,
    #[serde(default = "Utc::now")]
    pub timestamp: DateTime<Utc>,
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
        self.id == other.id
    }
}

impl Eq for Order {}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Trade {
    pub id: Uuid,
    pub taker_order_id: Uuid,
    pub maker_order_id: Uuid,
    #[serde(with = "rust_decimal::serde::str")]
    pub price: Decimal,
    #[serde(with = "rust_decimal::serde::str")]
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
    symbol: String,
    bids: BTreeMap<Reverse<Decimal>, VecDeque<Order>>, // Highest price first
    asks: BTreeMap<Decimal, VecDeque<Order>>,          // Lowest price first
    order_map: HashMap<Uuid, (OrderSide, Decimal, DateTime<Utc>)>,
}

impl MatchingEngine {
    pub fn new(symbol: String) -> Self {
        MatchingEngine {
            symbol,
            bids: BTreeMap::new(),
            asks: BTreeMap::new(),
            order_map: HashMap::new(),
        }
    }

    pub fn add_order(&mut self, mut order: Order) -> Vec<Trade> {
        let mut trades = Vec::new();
        use rust_decimal_macros::dec;

        // Add to order map first (will be removed if fully filled)
        self.order_map.insert(order.id, (order.side, order.price, order.timestamp));

        match order.side {
            OrderSide::Buy => {
                // Buy order: match against asks (sell orders)
                // We want to match with lowest ask prices first
                let mut asks_to_remove = Vec::new();

                for (ask_price, orders_at_price) in self.asks.iter_mut() {
                    // Buy order can match if its price >= ask price
                    if order.price >= *ask_price && order.quantity > dec!(0) {
                        let mut orders_to_remove_from_level = Vec::new();

                        for (idx, maker_order) in orders_at_price.iter_mut().enumerate() {
                            if order.quantity <= dec!(0) {
                                break;
                            }

                            let trade_quantity = order.quantity.min(maker_order.quantity);
                            let trade_price = maker_order.price; // Trade at maker's price

                            trades.push(Trade::new(
                                order.id,
                                maker_order.id,
                                trade_price,
                                trade_quantity,
                            ));

                            order.quantity -= trade_quantity;
                            maker_order.quantity -= trade_quantity;

                            if maker_order.quantity <= dec!(0) {
                                orders_to_remove_from_level.push(idx);
                                self.order_map.remove(&maker_order.id);
                            }
                        }

                        // Remove filled orders from this price level
                        for idx in orders_to_remove_from_level.iter().rev() {
                            orders_at_price.remove(*idx);
                        }

                        if orders_at_price.is_empty() {
                            asks_to_remove.push(*ask_price);
                        }

                        if order.quantity <= dec!(0) {
                            break; // Order fully filled
                        }
                    } else {
                        break; // No more matching prices (asks are sorted by price)
                    }
                }

                // Remove empty price levels
                for price in asks_to_remove {
                    self.asks.remove(&price);
                }

                // If order still has quantity, add to bid book
                if order.quantity > dec!(0) {
                    self.bids
                        .entry(Reverse(order.price))
                        .or_default()
                        .push_back(order);
                } else {
                    // Fully filled as taker, remove from order map
                    self.order_map.remove(&order.id);
                }
            }
            OrderSide::Sell => {
                // Sell order: match against bids (buy orders)
                // We want to match with highest bid prices first
                let mut bids_to_remove = Vec::new();

                for (bid_price_reverse, orders_at_price) in self.bids.iter_mut() {
                    let bid_price = bid_price_reverse.0; // Extract actual price from Reverse wrapper

                    // Sell order can match if its price <= bid price
                    if order.price <= bid_price && order.quantity > dec!(0) {
                        let mut orders_to_remove_from_level = Vec::new();

                        for (idx, maker_order) in orders_at_price.iter_mut().enumerate() {
                            if order.quantity <= dec!(0) {
                                break;
                            }

                            let trade_quantity = order.quantity.min(maker_order.quantity);
                            let trade_price = maker_order.price; // Trade at maker's price

                            trades.push(Trade::new(
                                order.id,
                                maker_order.id,
                                trade_price,
                                trade_quantity,
                            ));

                            order.quantity -= trade_quantity;
                            maker_order.quantity -= trade_quantity;

                            if maker_order.quantity <= dec!(0) {
                                orders_to_remove_from_level.push(idx);
                                self.order_map.remove(&maker_order.id);
                            }
                        }

                        // Remove filled orders from this price level
                        for idx in orders_to_remove_from_level.iter().rev() {
                            orders_at_price.remove(*idx);
                        }

                        if orders_at_price.is_empty() {
                            bids_to_remove.push(*bid_price_reverse);
                        }

                        if order.quantity <= dec!(0) {
                            break; // Order fully filled
                        }
                    } else {
                        break; // No more matching prices (bids are sorted by price desc)
                    }
                }

                // Remove empty price levels
                for price_reverse in bids_to_remove {
                    self.bids.remove(&price_reverse);
                }

                // If order still has quantity, add to ask book
                if order.quantity > dec!(0) {
                    self.asks
                        .entry(order.price)
                        .or_default()
                        .push_back(order);
                } else {
                    // Fully filled as taker, remove from order map
                    self.order_map.remove(&order.id);
                }
            }
        }
        trades
    }

    pub fn _cancel_order(&mut self, order_id: Uuid) -> Result<Order, String> {
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

    pub fn _get_bids(&self) -> &BTreeMap<Reverse<Decimal>, VecDeque<Order>> {
        &self.bids
    }

    pub fn _get_asks(&self) -> &BTreeMap<Decimal, VecDeque<Order>> {
        &self.asks
    }

    pub fn print_order_book(&self) {
        println!("\n--- ORDER BOOK for {} ----", self.symbol);

        // Print asks (sell orders) from lowest to highest price
        println!("Asks (Price | Total Quantity | Orders Count):");
        // Asks are already sorted from low to high, but let's reverse to show high to low
        // Actually, for traditional display, asks should show from high to low (away from spread)
        let mut ask_entries: Vec<_> = self.asks.iter().collect();
        ask_entries.reverse(); // Show highest ask prices first (further from spread)

        for (price, orders) in ask_entries {
            let total_quantity: Decimal = orders.iter().map(|o| o.quantity).sum();
            println!("  {} | {} | {}", price, total_quantity, orders.len());
        }

        println!("--- SPREAD ---");

        // Print bids (buy orders) from highest to lowest price
        println!("Bids (Price | Total Quantity | Orders Count):");
        // Bids are stored with Reverse, so iterating normally gives us high to low
        for (price_reverse, orders) in &self.bids {
            let total_quantity: Decimal = orders.iter().map(|o| o.quantity).sum();
            println!("  {} | {} | {}", price_reverse.0, total_quantity, orders.len());
        }

        println!("------------------\n");
    }

    // Helper method to get best bid and ask prices
    pub fn get_best_bid_ask(&self) -> (Option<Decimal>, Option<Decimal>) {
        let best_bid = self.bids.keys().next().map(|r| r.0);
        let best_ask = self.asks.keys().next().copied();
        (best_bid, best_ask)
    }

    // Helper method to get spread
    pub fn _get_spread(&self) -> Option<Decimal> {
        if let (Some(best_bid), Some(best_ask)) = self.get_best_bid_ask() {
            Some(best_ask - best_bid)
        } else {
            None
        }
    }
}
