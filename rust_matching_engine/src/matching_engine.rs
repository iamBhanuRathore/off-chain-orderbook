// matching_engine.rs

use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use std::cmp::{Ordering, Reverse};
use std::collections::{BTreeMap, HashMap, VecDeque};
use uuid::Uuid;
use rust_decimal_macros::dec;

// --- Core Enums and Structs ---
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum OrderType {
    Limit,
    Market,
}

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
    pub order_type: OrderType,
    pub side: OrderSide,
    #[serde(with = "rust_decimal::serde::str")]
    pub price: Decimal,
    #[serde(with = "rust_decimal::serde::str")]
    pub quantity: Decimal,
    #[serde(default = "Utc::now")]
    pub timestamp: DateTime<Utc>,
}

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
    pub fn new(taker_order_id: Uuid, maker_order_id: Uuid, price: Decimal, quantity: Decimal) -> Self {
        Self {
            id: Uuid::new_v4(),
            taker_order_id,
            maker_order_id,
            price,
            quantity,
            timestamp: Utc::now(),
        }
    }
}

// --- Structs for Data Publishing ---
#[derive(Serialize, Debug, Clone)]
pub enum DeltaAction {
    New,
    Update,
    Delete,
}

#[derive(Serialize, Debug, Clone)]
pub struct OrderBookDelta {
    pub action: DeltaAction,
    pub side: OrderSide,
    #[serde(with = "rust_decimal::serde::str")]
    pub price: Decimal,
    #[serde(with = "rust_decimal::serde::str")]
    pub new_quantity: Decimal,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OrderBookLevel {
    #[serde(with = "rust_decimal::serde::str")]
    pub price: Decimal,
    #[serde(with = "rust_decimal::serde::str")]
    pub quantity: Decimal,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OrderBookSnapshot {
    pub symbol: String,
    pub bids: Vec<OrderBookLevel>,
    pub asks: Vec<OrderBookLevel>,
    #[serde(with = "rust_decimal::serde::str_option")]
    pub last_traded_price: Option<Decimal>,
    pub timestamp: DateTime<Utc>,
}


// --- Internal Engine Structures ---
#[derive(Debug, Clone)]
struct PriceLevel {
    total_quantity: Decimal,
    orders: VecDeque<Order>,
}

impl PriceLevel {
    fn new() -> Self {
        PriceLevel {
            total_quantity: Decimal::ZERO,
            orders: VecDeque::new(),
        }
    }
}

pub struct MatchingEngine {
    symbol: String,
    bids: BTreeMap<Reverse<Decimal>, PriceLevel>,
    asks: BTreeMap<Decimal, PriceLevel>,
    order_map: HashMap<Uuid, (OrderSide, Decimal)>,
    last_traded_price: Option<Decimal>,
}

// --- Core Engine Implementation ---
impl MatchingEngine {
    pub fn new(symbol: String) -> Self {
        MatchingEngine {
            symbol,
            bids: BTreeMap::new(),
            asks: BTreeMap::new(),
            order_map: HashMap::new(),
            last_traded_price: None,
        }
    }

    pub fn add_order(&mut self, order: Order) -> (Vec<Trade>, Vec<OrderBookDelta>) {
        match order.order_type {
            OrderType::Limit => self.process_limit_order(order),
            OrderType::Market => self.process_market_order(order),
        }
    }

    pub fn cancel_order(&mut self, order_id: Uuid) -> (Result<Order, String>, Vec<OrderBookDelta>) {
        let mut deltas = Vec::new();
        if let Some((side, price)) = self.order_map.remove(&order_id) {
            let book = match side {
                OrderSide::Buy => self.bids.get_mut(&Reverse(price)),
                OrderSide::Sell => self.asks.get_mut(&price),
            };

            if let Some(level) = book {
                if let Some(pos) = level.orders.iter().position(|o| o.id == order_id) {
                    let removed_order = level.orders.remove(pos).unwrap();
                    level.total_quantity -= removed_order.quantity;

                    if level.orders.is_empty() {
                        deltas.push(OrderBookDelta {
                            action: DeltaAction::Delete,
                            side,
                            price,
                            new_quantity: Decimal::ZERO,
                        });
                        if side == OrderSide::Buy {
                            self.bids.remove(&Reverse(price));
                        } else {
                            self.asks.remove(&price);
                        }
                    } else {
                        deltas.push(OrderBookDelta {
                            action: DeltaAction::Update,
                            side,
                            price,
                            new_quantity: level.total_quantity,
                        });
                    }
                    return (Ok(removed_order), deltas);
                }
            }
            (Err(format!("[Engine] Order {} in map but not in book.", order_id)), deltas)
        } else {
            (Err(format!("[Engine] Order {} not found for cancellation.", order_id)), deltas)
        }
    }

    fn process_market_order(&mut self, mut order: Order) -> (Vec<Trade>, Vec<OrderBookDelta>) {
        let mut trades = Vec::new();
        let mut deltas = Vec::new();

        match order.side {
            OrderSide::Buy => {
                let mut prices_to_remove = Vec::new();
                let relevant_prices: Vec<Decimal> = self.asks.keys().cloned().collect();
                for price in relevant_prices {
                    if order.quantity <= dec!(0) { break; }
                    if let Some(level) = self.asks.get_mut(&price) {
                        // FINAL FIX: Pass disjoint fields `self.order_map` and `level` to the free function.
                        let (new_trades, new_deltas) = process_level(&mut self.order_map, &mut order, level, price);
                        trades.extend(new_trades);
                        deltas.extend(new_deltas);
                        if level.orders.is_empty() { prices_to_remove.push(price); }
                    }
                }
                for price in prices_to_remove { self.asks.remove(&price); }
            }
            OrderSide::Sell => {
                let mut prices_to_remove = Vec::new();
                let relevant_prices: Vec<Reverse<Decimal>> = self.bids.keys().cloned().collect();
                for price_rev in relevant_prices {
                    if order.quantity <= dec!(0) { break; }
                    if let Some(level) = self.bids.get_mut(&price_rev) {
                         // FINAL FIX: Pass disjoint fields `self.order_map` and `level` to the free function.
                        let (new_trades, new_deltas) = process_level(&mut self.order_map, &mut order, level, price_rev.0);
                        trades.extend(new_trades);
                        deltas.extend(new_deltas);
                        if level.orders.is_empty() { prices_to_remove.push(price_rev); }
                    }
                }
                for price in prices_to_remove { self.bids.remove(&price); }
            }
        }

        if let Some(last_trade) = trades.last() { self.last_traded_price = Some(last_trade.price); }
        (trades, deltas)
    }

    fn process_limit_order(&mut self, mut order: Order) -> (Vec<Trade>, Vec<OrderBookDelta>) {
        let mut trades = Vec::new();
        let mut deltas = Vec::new();

        self.order_map.insert(order.id, (order.side, order.price));

        match order.side {
            OrderSide::Buy => {
                let mut prices_to_remove = Vec::new();
                let ask_prices_to_match: Vec<Decimal> = self.asks.range(..=order.price).map(|(p, _)| *p).collect();

                for price in ask_prices_to_match {
                    if order.quantity <= dec!(0) { break; }
                    if let Some(level) = self.asks.get_mut(&price) {
                         // FINAL FIX: Pass disjoint fields `self.order_map` and `level` to the free function.
                        let (new_trades, new_deltas) = process_level(&mut self.order_map, &mut order, level, price);
                        trades.extend(new_trades);
                        deltas.extend(new_deltas);
                        if level.orders.is_empty() {
                            prices_to_remove.push(price);
                        }
                    }
                }

                for price in prices_to_remove { self.asks.remove(&price); }

                if order.quantity > dec!(0) {
                    let level = self.bids.entry(Reverse(order.price)).or_insert_with(PriceLevel::new);
                    let is_new_level = level.orders.is_empty();
                    level.total_quantity += order.quantity;
                    level.orders.push_back(order);
                    deltas.push(OrderBookDelta {
                        action: if is_new_level { DeltaAction::New } else { DeltaAction::Update },
                        side: OrderSide::Buy,
                        price: level.orders[0].price,
                        new_quantity: level.total_quantity,
                    });
                } else { self.order_map.remove(&order.id); }
            }
            OrderSide::Sell => {
                let mut prices_to_remove = Vec::new();
                let bid_prices_to_match: Vec<Reverse<Decimal>> = self.bids.range(Reverse(order.price)..).map(|(p, _)| *p).collect();

                for price_rev in bid_prices_to_match {
                    if order.quantity <= dec!(0) { break; }
                     if let Some(level) = self.bids.get_mut(&price_rev) {
                         // FINAL FIX: Pass disjoint fields `self.order_map` and `level` to the free function.
                        let (new_trades, new_deltas) = process_level(&mut self.order_map, &mut order, level, price_rev.0);
                        trades.extend(new_trades);
                        deltas.extend(new_deltas);
                        if level.orders.is_empty() {
                            prices_to_remove.push(price_rev);
                        }
                    }
                }

                for price_rev in prices_to_remove { self.bids.remove(&price_rev); }

                if order.quantity > dec!(0) {
                    let level = self.asks.entry(order.price).or_insert_with(PriceLevel::new);
                    let is_new_level = level.orders.is_empty();
                    level.total_quantity += order.quantity;
                    level.orders.push_back(order);
                    deltas.push(OrderBookDelta {
                        action: if is_new_level { DeltaAction::New } else { DeltaAction::Update },
                        side: OrderSide::Sell,
                        price: level.orders[0].price,
                        new_quantity: level.total_quantity,
                    });
                } else { self.order_map.remove(&order.id); }
            }
        }

        if let Some(last_trade) = trades.last() { self.last_traded_price = Some(last_trade.price); }
        (trades, deltas)
    }

    pub fn get_order_book_snapshot(&self) -> OrderBookSnapshot {
        let bids = self.bids.iter().map(|(price_rev, level)| {
            OrderBookLevel { price: price_rev.0, quantity: level.total_quantity }
        }).collect();

        let asks = self.asks.iter().map(|(price, level)| {
             OrderBookLevel { price: *price, quantity: level.total_quantity }
        }).collect();

        OrderBookSnapshot {
            symbol: self.symbol.clone(),
            bids,
            asks,
            last_traded_price: self.last_traded_price,
            timestamp: Utc::now(),
        }
    }

    pub fn get_last_traded_price(&self) -> Option<Decimal> {
        self.last_traded_price
    }
}

// FINAL FIX: `process_level` is now a "free function", not a method.
// It no longer takes `&mut self`. Instead, the specific, disjoint fields it needs
// (`order_map` and `level`) are passed in directly. This resolves the borrow checker conflict.
fn process_level(
    order_map: &mut HashMap<Uuid, (OrderSide, Decimal)>,
    taker_order: &mut Order,
    level: &mut PriceLevel,
    trade_price: Decimal
) -> (Vec<Trade>, Vec<OrderBookDelta>) {
    let mut trades = Vec::new();
    let mut deltas = Vec::new();
    let mut orders_to_remove_indices = Vec::new();
    let maker_side = if taker_order.side == OrderSide::Buy { OrderSide::Sell } else { OrderSide::Buy };

    for (idx, maker_order) in level.orders.iter_mut().enumerate() {
        if taker_order.quantity <= dec!(0) { break; }
        let trade_quantity = taker_order.quantity.min(maker_order.quantity);

        trades.push(Trade::new(taker_order.id, maker_order.id, trade_price, trade_quantity));

        taker_order.quantity -= trade_quantity;
        maker_order.quantity -= trade_quantity;
        level.total_quantity -= trade_quantity;

        if maker_order.quantity <= dec!(0) {
            orders_to_remove_indices.push(idx);
            // Now using the passed-in `order_map`
            order_map.remove(&maker_order.id);
        }
    }

    for &idx in orders_to_remove_indices.iter().rev() {
        level.orders.remove(idx);
    }

    deltas.push(OrderBookDelta {
        action: if level.orders.is_empty() { DeltaAction::Delete } else { DeltaAction::Update },
        side: maker_side,
        price: trade_price,
        new_quantity: level.total_quantity
    });

    (trades, deltas)
}
