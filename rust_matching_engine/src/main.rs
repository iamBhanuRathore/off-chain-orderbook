
mod matching_engine;
mod consumer;
use matching_engine::{MatchingEngine, Order, OrderSide};
use rust_decimal_macros::dec;
use uuid::Uuid; // For easily creating Decimals

fn main() {
    let mut engine = MatchingEngine::new();

    println!("--- Initial Empty Order Book ---");
    engine.print_order_book();

    // --- Scenario 1: Add some asks ---
    println!("\n--- Adding Asks ---");
    let ask1 = Order::new(101, OrderSide::Sell, dec!(100.50), dec!(10));
    println!("Adding Ask: ID={}, P={}, Q={}", ask1.id, ask1.price, ask1.quantity);
    engine.add_order(ask1);

    let ask2 = Order::new(102, OrderSide::Sell, dec!(101.00), dec!(5));
    println!("Adding Ask: ID={}, P={}, Q={}", ask2.id, ask2.price, ask2.quantity);
    engine.add_order(ask2);

    let ask3_same_price = Order::new(103, OrderSide::Sell, dec!(100.50), dec!(3)); // Same price as ask1, but later
    println!("Adding Ask (Same Price): ID={}, P={}, Q={}", ask3_same_price.id, ask3_same_price.price, ask3_same_price.quantity);
    engine.add_order(ask3_same_price);

    engine.print_order_book();

    // --- Scenario 2: Add some bids ---
    println!("\n--- Adding Bids ---");
    let bid1 = Order::new(201, OrderSide::Buy, dec!(99.50), dec!(8));
    println!("Adding Bid: ID={}, P={}, Q={}", bid1.id, bid1.price, bid1.quantity);
    engine.add_order(bid1);

    let bid2 = Order::new(202, OrderSide::Buy, dec!(99.00), dec!(12));
    println!("Adding Bid: ID={}, P={}, Q={}", bid2.id, bid2.price, bid2.quantity);
    engine.add_order(bid2);
    engine.print_order_book();

    // --- Scenario 3: Add a buy order that matches ---
    println!("\n--- Adding Buy Order that Matches ---");
    let buy_taker1 = Order::new(301, OrderSide::Buy, dec!(100.75), dec!(15)); // Price crosses spread, quantity > first ask
    println!("Adding Taker Buy: ID={}, P={}, Q={}", buy_taker1.id, buy_taker1.price, buy_taker1.quantity);
    let trades1 = engine.add_order(buy_taker1);

    println!("Generated Trades:");
    for trade in trades1 {
        println!("  Trade: TakerID={}, MakerID={}, P={}, Q={}", trade.taker_order_id, trade.maker_order_id, trade.price, trade.quantity);
    }
    engine.print_order_book();

    // --- Scenario 4: Add a sell order that partially fills and then rests ---
    println!("\n--- Adding Sell Order that Partially Fills ---");
    let sell_taker1 = Order::new(401, OrderSide::Sell, dec!(99.25), dec!(10)); // Price crosses spread, Q > first bid but < total bids
    println!("Adding Taker Sell: ID={}, P={}, Q={}", sell_taker1.id, sell_taker1.price, sell_taker1.quantity);
    let trades2 = engine.add_order(sell_taker1);

    println!("Generated Trades:");
    for trade in trades2 {
        println!("  Trade: TakerID={}, MakerID={}, P={}, Q={}", trade.taker_order_id, trade.maker_order_id, trade.price, trade.quantity);
    }
    engine.print_order_book();

    // --- Scenario 5: Cancel an existing order ---
    println!("\n--- Cancelling an Order ---");
    // Let's try to cancel bid2 (P=99.00, Q=12 originally)
    // We need its ID. In a real system, you'd get this from the user or your records.
    // For this test, let's assume we know bid2's original quantity was 12.
    // Find an order on the bid side with price 99.00.
    // This is a simplification; in a real system, you'd use the order_map to find the ID.
    let mut order_to_cancel_id_option: Option<Uuid> = None;
    if let Some(orders_at_99) = engine.get_bids().get(&std::cmp::Reverse(dec!(99.00))) {
        if let Some(order) = orders_at_99.front() { // Example: cancel the first one at this price
             if order.user_id == 202 { // Check if it's the one we expect (bid2 user_id)
                order_to_cancel_id_option = Some(order.id);
             }
        }
    }

    if let Some(order_id_to_cancel) = order_to_cancel_id_option {
        println!("Attempting to cancel order ID: {}", order_id_to_cancel);
        match engine.cancel_order(order_id_to_cancel) {
            Ok(cancelled_order) => {
                println!("Successfully cancelled order: ID={}, P={}, Q={}", cancelled_order.id, cancelled_order.price, cancelled_order.quantity);
            }
            Err(e) => println!("Cancellation failed: {}", e),
        }
    } else {
        println!("Could not find bid2 to cancel (it might have been fully filled or test logic error).");
    }
    engine.print_order_book();

    // Test cancelling a non-existent order
    println!("\n--- Cancelling a Non-Existent Order ---");
    let non_existent_id = Uuid::new_v4();
     match engine.cancel_order(non_existent_id) {
        Ok(_) => println!("This should not happen!"),
        Err(e) => println!("Cancellation failed as expected: {}", e),
    }
    engine.print_order_book();
}
