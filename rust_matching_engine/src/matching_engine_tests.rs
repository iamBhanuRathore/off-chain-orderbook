#[cfg(test)]
mod matching_engine_tests {
    use super::super::matching_engine::*;
    use chrono::Utc;
    use rust_decimal::prelude::*;
    use rust_decimal_macros::dec;
    use uuid::Uuid;

    fn setup() -> MatchingEngine {
        MatchingEngine::new("TEST_SYMBOL".to_string())
    }

    #[test]
    fn test_add_limit_buy_order_no_match() {
        let mut engine = setup();
        let order = Order {
            id: Uuid::new_v4(),
            user_id: 1,
            order_type: OrderType::Limit,
            side: OrderSide::Buy,
            price: dec!(100),
            quantity: dec!(10),
            timestamp: Utc::now(),
        };
        let (trades, deltas) = engine.add_order(order.clone());

        assert!(trades.is_empty());
        assert_eq!(deltas.len(), 1);
        assert_eq!(deltas[0].action, DeltaAction::New);
        assert_eq!(deltas[0].side, OrderSide::Buy);
        assert_eq!(deltas[0].price, dec!(100));
        assert_eq!(deltas[0].new_quantity, dec!(10));

        let snapshot = engine.get_order_book_snapshot();
        assert_eq!(snapshot.bids.len(), 1);
        assert_eq!(snapshot.bids[0].price, dec!(100));
        assert_eq!(snapshot.bids[0].quantity, dec!(10));
        assert!(snapshot.asks.is_empty());
    }

    #[test]
    fn test_add_limit_sell_order_no_match() {
        let mut engine = setup();
        let order = Order {
            id: Uuid::new_v4(),
            user_id: 1,
            order_type: OrderType::Limit,
            side: OrderSide::Sell,
            price: dec!(100),
            quantity: dec!(10),
            timestamp: Utc::now(),
        };
        let (trades, deltas) = engine.add_order(order.clone());

        assert!(trades.is_empty());
        assert_eq!(deltas.len(), 1);
        assert_eq!(deltas[0].action, DeltaAction::New);
        assert_eq!(deltas[0].side, OrderSide::Sell);
        assert_eq!(deltas[0].price, dec!(100));
        assert_eq!(deltas[0].new_quantity, dec!(10));

        let snapshot = engine.get_order_book_snapshot();
        assert_eq!(snapshot.asks.len(), 1);
        assert_eq!(snapshot.asks[0].price, dec!(100));
        assert_eq!(snapshot.asks[0].quantity, dec!(10));
        assert!(snapshot.bids.is_empty());
    }

    #[test]
    fn test_limit_order_full_match() {
        let mut engine = setup();
        let sell_order = Order {
            id: Uuid::new_v4(),
            user_id: 1,
            order_type: OrderType::Limit,
            side: OrderSide::Sell,
            price: dec!(100),
            quantity: dec!(10),
            timestamp: Utc::now(),
        };
        engine.add_order(sell_order.clone());

        let buy_order = Order {
            id: Uuid::new_v4(),
            user_id: 2,
            order_type: OrderType::Limit,
            side: OrderSide::Buy,
            price: dec!(100),
            quantity: dec!(10),
            timestamp: Utc::now(),
        };
        let (trades, deltas) = engine.add_order(buy_order.clone());

        assert_eq!(trades.len(), 1);
        assert_eq!(trades[0].price, dec!(100));
        assert_eq!(trades[0].quantity, dec!(10));
        assert_eq!(trades[0].taker_order_id, buy_order.id);
        assert_eq!(trades[0].maker_order_id, sell_order.id);

        assert_eq!(deltas.len(), 1);
        assert_eq!(deltas[0].action, DeltaAction::Delete);
        assert_eq!(deltas[0].side, OrderSide::Sell);
        assert_eq!(deltas[0].price, dec!(100));
        assert_eq!(deltas[0].new_quantity, dec!(0));

        let snapshot = engine.get_order_book_snapshot();
        assert!(snapshot.bids.is_empty());
        assert!(snapshot.asks.is_empty());
        assert_eq!(engine.get_last_traded_price(), Some(dec!(100)));
    }

    #[test]
    fn test_limit_order_partial_match_taker_fully_filled() {
        let mut engine = setup();
        let sell_order = Order {
            id: Uuid::new_v4(),
            user_id: 1,
            order_type: OrderType::Limit,
            side: OrderSide::Sell,
            price: dec!(100),
            quantity: dec!(15),
            timestamp: Utc::now(),
        };
        engine.add_order(sell_order.clone());

        let buy_order = Order {
            id: Uuid::new_v4(),
            user_id: 2,
            order_type: OrderType::Limit,
            side: OrderSide::Buy,
            price: dec!(100),
            quantity: dec!(10),
            timestamp: Utc::now(),
        };
        let (trades, deltas) = engine.add_order(buy_order.clone());

        assert_eq!(trades.len(), 1);
        assert_eq!(trades[0].price, dec!(100));
        assert_eq!(trades[0].quantity, dec!(10));

        assert_eq!(deltas.len(), 1);
        assert_eq!(deltas[0].action, DeltaAction::Update);
        assert_eq!(deltas[0].side, OrderSide::Sell);
        assert_eq!(deltas[0].price, dec!(100));
        assert_eq!(deltas[0].new_quantity, dec!(5)); // Remaining 5

        let snapshot = engine.get_order_book_snapshot();
        assert!(snapshot.bids.is_empty());
        assert_eq!(snapshot.asks.len(), 1);
        assert_eq!(snapshot.asks[0].price, dec!(100));
        assert_eq!(snapshot.asks[0].quantity, dec!(5));
        assert_eq!(engine.get_last_traded_price(), Some(dec!(100)));
    }

    #[test]
    fn test_limit_order_partial_match_maker_fully_filled() {
        let mut engine = setup();
        let sell_order = Order {
            id: Uuid::new_v4(),
            user_id: 1,
            order_type: OrderType::Limit,
            side: OrderSide::Sell,
            price: dec!(100),
            quantity: dec!(10),
            timestamp: Utc::now(),
        };
        engine.add_order(sell_order.clone());

        let buy_order = Order {
            id: Uuid::new_v4(),
            user_id: 2,
            order_type: OrderType::Limit,
            side: OrderSide::Buy,
            price: dec!(100),
            quantity: dec!(15),
            timestamp: Utc::now(),
        };
        let (trades, deltas) = engine.add_order(buy_order.clone());

        assert_eq!(trades.len(), 1);
        assert_eq!(trades[0].price, dec!(100));
        assert_eq!(trades[0].quantity, dec!(10));

        assert_eq!(deltas.len(), 2); // One for delete, one for new resting buy order
        assert_eq!(deltas[0].action, DeltaAction::Delete);
        assert_eq!(deltas[0].side, OrderSide::Sell);
        assert_eq!(deltas[0].price, dec!(100));
        assert_eq!(deltas[0].new_quantity, dec!(0));

        assert_eq!(deltas[1].action, DeltaAction::New);
        assert_eq!(deltas[1].side, OrderSide::Buy);
        assert_eq!(deltas[1].price, dec!(100));
        assert_eq!(deltas[1].new_quantity, dec!(5)); // Remaining 5

        let snapshot = engine.get_order_book_snapshot();
        assert_eq!(snapshot.bids.len(), 1);
        assert_eq!(snapshot.bids[0].price, dec!(100));
        assert_eq!(snapshot.bids[0].quantity, dec!(5));
        assert!(snapshot.asks.is_empty());
        assert_eq!(engine.get_last_traded_price(), Some(dec!(100)));
    }

    #[test]
    fn test_multiple_limit_orders_at_same_price() {
        let mut engine = setup();
        let sell_order_1 = Order {
            id: Uuid::new_v4(),
            user_id: 1,
            order_type: OrderType::Limit,
            side: OrderSide::Sell,
            price: dec!(100),
            quantity: dec!(5),
            timestamp: Utc::now(),
        };
        let sell_order_2 = Order {
            id: Uuid::new_v4(),
            user_id: 1,
            order_type: OrderType::Limit,
            side: OrderSide::Sell,
            price: dec!(100),
            quantity: dec!(7),
            timestamp: Utc::now(),
        };
        engine.add_order(sell_order_1.clone());
        engine.add_order(sell_order_2.clone());

        let buy_order = Order {
            id: Uuid::new_v4(),
            user_id: 2,
            order_type: OrderType::Limit,
            side: OrderSide::Buy,
            price: dec!(100),
            quantity: dec!(10),
            timestamp: Utc::now(),
        };
        let (trades, deltas) = engine.add_order(buy_order.clone());

        assert_eq!(trades.len(), 2);
        assert_eq!(trades[0].quantity, dec!(5));
        assert_eq!(trades[1].quantity, dec!(5)); // 10 - 5 = 5 remaining from taker, fills 5 from second maker

        assert_eq!(deltas.len(), 2);
        assert_eq!(deltas[0].action, DeltaAction::Delete); // sell_order_1 fully filled
        assert_eq!(deltas[0].side, OrderSide::Sell);
        assert_eq!(deltas[0].price, dec!(100));
        assert_eq!(deltas[0].new_quantity, dec!(0));

        assert_eq!(deltas[1].action, DeltaAction::Update); // sell_order_2 partially filled
        assert_eq!(deltas[1].side, OrderSide::Sell);
        assert_eq!(deltas[1].price, dec!(100));
        assert_eq!(deltas[1].new_quantity, dec!(2)); // 7 - 5 = 2 remaining

        let snapshot = engine.get_order_book_snapshot();
        assert_eq!(snapshot.asks.len(), 1);
        assert_eq!(snapshot.asks[0].quantity, dec!(2));
        assert_eq!(engine.get_last_traded_price(), Some(dec!(100)));
    }

    #[test]
    fn test_market_buy_order_full_fill() {
        let mut engine = setup();
        let sell_order_1 = Order {
            id: Uuid::new_v4(),
            user_id: 1,
            order_type: OrderType::Limit,
            side: OrderSide::Sell,
            price: dec!(100),
            quantity: dec!(5),
            timestamp: Utc::now(),
        };
        let sell_order_2 = Order {
            id: Uuid::new_v4(),
            user_id: 1,
            order_type: OrderType::Limit,
            side: OrderSide::Sell,
            price: dec!(101),
            quantity: dec!(7),
            timestamp: Utc::now(),
        };
        engine.add_order(sell_order_1.clone());
        engine.add_order(sell_order_2.clone());

        let buy_market_order = Order {
            id: Uuid::new_v4(),
            user_id: 2,
            order_type: OrderType::Market,
            side: OrderSide::Buy,
            price: dec!(0), // Market orders don't have a price
            quantity: dec!(12),
            timestamp: Utc::now(),
        };
        let (trades, deltas) = engine.add_order(buy_market_order.clone());

        assert_eq!(trades.len(), 2);
        assert_eq!(trades[0].price, dec!(100));
        assert_eq!(trades[0].quantity, dec!(5));
        assert_eq!(trades[1].price, dec!(101));
        assert_eq!(trades[1].quantity, dec!(7));

        assert_eq!(deltas.len(), 2);
        assert_eq!(deltas[0].action, DeltaAction::Delete);
        assert_eq!(deltas[0].side, OrderSide::Sell);
        assert_eq!(deltas[0].price, dec!(100));
        assert_eq!(deltas[1].action, DeltaAction::Delete);
        assert_eq!(deltas[1].side, OrderSide::Sell);
        assert_eq!(deltas[1].price, dec!(101));

        let snapshot = engine.get_order_book_snapshot();
        assert!(snapshot.bids.is_empty());
        assert!(snapshot.asks.is_empty());
        assert_eq!(engine.get_last_traded_price(), Some(dec!(101)));
    }

    #[test]
    fn test_market_sell_order_partial_fill() {
        let mut engine = setup();
        let buy_order_1 = Order {
            id: Uuid::new_v4(),
            user_id: 1,
            order_type: OrderType::Limit,
            side: OrderSide::Buy,
            price: dec!(100),
            quantity: dec!(5),
            timestamp: Utc::now(),
        };
        let buy_order_2 = Order {
            id: Uuid::new_v4(),
            user_id: 1,
            order_type: OrderType::Limit,
            side: OrderSide::Buy,
            price: dec!(99),
            quantity: dec!(7),
            timestamp: Utc::now(),
        };
        engine.add_order(buy_order_1.clone());
        engine.add_order(buy_order_2.clone());

        let sell_market_order = Order {
            id: Uuid::new_v4(),
            user_id: 2,
            order_type: OrderType::Market,
            side: OrderSide::Sell,
            price: dec!(0),
            quantity: dec!(8),
            timestamp: Utc::now(),
        };
        let (trades, deltas) = engine.add_order(sell_market_order.clone());

        assert_eq!(trades.len(), 2);
        assert_eq!(trades[0].price, dec!(100));
        assert_eq!(trades[0].quantity, dec!(5));
        assert_eq!(trades[1].price, dec!(99));
        assert_eq!(trades[1].quantity, dec!(3)); // 8 - 5 = 3 remaining from taker, fills 3 from second maker

        assert_eq!(deltas.len(), 2);
        assert_eq!(deltas[0].action, DeltaAction::Delete);
        assert_eq!(deltas[0].side, OrderSide::Buy);
        assert_eq!(deltas[0].price, dec!(100));
        assert_eq!(deltas[1].action, DeltaAction::Update);
        assert_eq!(deltas[1].side, OrderSide::Buy);
        assert_eq!(deltas[1].price, dec!(99));
        assert_eq!(deltas[1].new_quantity, dec!(4)); // 7 - 3 = 4 remaining

        let snapshot = engine.get_order_book_snapshot();
        assert_eq!(snapshot.bids.len(), 1);
        assert_eq!(snapshot.bids[0].price, dec!(99));
        assert_eq!(snapshot.bids[0].quantity, dec!(4));
        assert!(snapshot.asks.is_empty());
        assert_eq!(engine.get_last_traded_price(), Some(dec!(99)));
    }

    #[test]
    fn test_cancel_existing_order() {
        let mut engine = setup();
        let order = Order {
            id: Uuid::new_v4(),
            user_id: 1,
            order_type: OrderType::Limit,
            side: OrderSide::Buy,
            price: dec!(100),
            quantity: dec!(10),
            timestamp: Utc::now(),
        };
        engine.add_order(order.clone());

        let (result, deltas) = engine.cancel_order(order.id);
        assert!(result.is_ok());
        assert_eq!(result.unwrap().id, order.id);

        assert_eq!(deltas.len(), 1);
        assert_eq!(deltas[0].action, DeltaAction::Delete);
        assert_eq!(deltas[0].side, OrderSide::Buy);
        assert_eq!(deltas[0].price, dec!(100));
        assert_eq!(deltas[0].new_quantity, dec!(0));

        let snapshot = engine.get_order_book_snapshot();
        assert!(snapshot.bids.is_empty());
    }

    #[test]
    fn test_cancel_non_existing_order() {
        let mut engine = setup();
        let non_existent_id = Uuid::new_v4();
        let (result, deltas) = engine.cancel_order(non_existent_id);
        assert!(result.is_err());
        assert_eq!(
            result.unwrap_err(),
            format!(
                "[Engine] Order {} not found for cancellation.",
                non_existent_id
            )
        );
        assert!(deltas.is_empty());
    }

    #[test]
    fn test_cancel_order_after_partial_fill() {
        let mut engine = setup();
        let sell_order = Order {
            id: Uuid::new_v4(),
            user_id: 1,
            order_type: OrderType::Limit,
            side: OrderSide::Sell,
            price: dec!(100),
            quantity: dec!(15),
            timestamp: Utc::now(),
        };
        engine.add_order(sell_order.clone());

        let buy_order = Order {
            id: Uuid::new_v4(),
            user_id: 2,
            order_type: OrderType::Limit,
            side: OrderSide::Buy,
            price: dec!(100),
            quantity: dec!(10),
            timestamp: Utc::now(),
        };
        engine.add_order(buy_order.clone()); // This will partially fill sell_order

        let (result, deltas) = engine.cancel_order(sell_order.id);
        assert!(result.is_ok());
        assert_eq!(result.unwrap().id, sell_order.id); // Should return the original order

        assert_eq!(deltas.len(), 1);
        assert_eq!(deltas[0].action, DeltaAction::Delete);
        assert_eq!(deltas[0].side, OrderSide::Sell);
        assert_eq!(deltas[0].price, dec!(100));
        assert_eq!(deltas[0].new_quantity, dec!(0));

        let snapshot = engine.get_order_book_snapshot();
        assert!(snapshot.asks.is_empty());
    }

    #[test]
    fn test_order_book_snapshot() {
        let mut engine = setup();
        engine.add_order(Order {
            id: Uuid::new_v4(),
            user_id: 1,
            order_type: OrderType::Limit,
            side: OrderSide::Buy,
            price: dec!(100),
            quantity: dec!(10),
            timestamp: Utc::now(),
        });
        engine.add_order(Order {
            id: Uuid::new_v4(),
            user_id: 2,
            order_type: OrderType::Limit,
            side: OrderSide::Buy,
            price: dec!(99),
            quantity: dec!(5),
            timestamp: Utc::now(),
        });
        engine.add_order(Order {
            id: Uuid::new_v4(),
            user_id: 3,
            order_type: OrderType::Limit,
            side: OrderSide::Sell,
            price: dec!(101),
            quantity: dec!(12),
            timestamp: Utc::now(),
        });
        engine.add_order(Order {
            id: Uuid::new_v4(),
            user_id: 4,
            order_type: OrderType::Limit,
            side: OrderSide::Sell,
            price: dec!(102),
            quantity: dec!(8),
            timestamp: Utc::now(),
        });

        let snapshot = engine.get_order_book_snapshot();
        assert_eq!(snapshot.symbol, "TEST_SYMBOL");
        assert_eq!(snapshot.bids.len(), 2);
        assert_eq!(snapshot.bids[0].price, dec!(100));
        assert_eq!(snapshot.bids[0].quantity, dec!(10));
        assert_eq!(snapshot.bids[1].price, dec!(99));
        assert_eq!(snapshot.bids[1].quantity, dec!(5));

        assert_eq!(snapshot.asks.len(), 2);
        assert_eq!(snapshot.asks[0].price, dec!(101));
        assert_eq!(snapshot.asks[0].quantity, dec!(12));
        assert_eq!(snapshot.asks[1].price, dec!(102));
        assert_eq!(snapshot.asks[1].quantity, dec!(8));
        assert_eq!(snapshot.last_traded_price, None);
    }

    #[test]
    fn test_ltp_update() {
        let mut engine = setup();
        let sell_order = Order {
            id: Uuid::new_v4(),
            user_id: 1,
            order_type: OrderType::Limit,
            side: OrderSide::Sell,
            price: dec!(100),
            quantity: dec!(10),
            timestamp: Utc::now(),
        };
        engine.add_order(sell_order.clone());

        let buy_order = Order {
            id: Uuid::new_v4(),
            user_id: 2,
            order_type: OrderType::Limit,
            side: OrderSide::Buy,
            price: dec!(100),
            quantity: dec!(10),
            timestamp: Utc::now(),
        };
        engine.add_order(buy_order.clone());

        assert_eq!(engine.get_last_traded_price(), Some(dec!(100)));
    }

    #[test]
    fn test_market_order_no_liquidity() {
        let mut engine = setup();
        let buy_market_order = Order {
            id: Uuid::new_v4(),
            user_id: 1,
            order_type: OrderType::Market,
            side: OrderSide::Buy,
            price: dec!(0),
            quantity: dec!(10),
            timestamp: Utc::now(),
        };
        let (trades, deltas) = engine.add_order(buy_market_order.clone());

        assert!(trades.is_empty());
        assert!(deltas.is_empty());
        assert_eq!(engine.get_last_traded_price(), None);
    }

    #[test]
    fn test_limit_order_zero_quantity() {
        let mut engine = setup();
        let order = Order {
            id: Uuid::new_v4(),
            user_id: 1,
            order_type: OrderType::Limit,
            side: OrderSide::Buy,
            price: dec!(100),
            quantity: dec!(0),
            timestamp: Utc::now(),
        };
        let (trades, deltas) = engine.add_order(order.clone());

        assert!(trades.is_empty());
        assert!(deltas.is_empty());
        let snapshot = engine.get_order_book_snapshot();
        assert!(snapshot.bids.is_empty());
    }

    #[test]
    fn test_market_order_zero_quantity() {
        let mut engine = setup();
        let order = Order {
            id: Uuid::new_v4(),
            user_id: 1,
            order_type: OrderType::Market,
            side: OrderSide::Buy,
            price: dec!(0),
            quantity: dec!(0),
            timestamp: Utc::now(),
        };
        let (trades, deltas) = engine.add_order(order.clone());

        assert!(trades.is_empty());
        assert!(deltas.is_empty());
    }

    #[test]
    fn test_multiple_price_levels_matching() {
        let mut engine = setup();
        // Sell orders
        engine.add_order(Order {
            id: Uuid::new_v4(),
            user_id: 1,
            order_type: OrderType::Limit,
            side: OrderSide::Sell,
            price: dec!(100),
            quantity: dec!(5),
            timestamp: Utc::now(),
        });
        engine.add_order(Order {
            id: Uuid::new_v4(),
            user_id: 2,
            order_type: OrderType::Limit,
            side: OrderSide::Sell,
            price: dec!(101),
            quantity: dec!(5),
            timestamp: Utc::now(),
        });
        engine.add_order(Order {
            id: Uuid::new_v4(),
            user_id: 3,
            order_type: OrderType::Limit,
            side: OrderSide::Sell,
            price: dec!(102),
            quantity: dec!(5),
            timestamp: Utc::now(),
        });

        // Buy order that crosses multiple levels
        let buy_order = Order {
            id: Uuid::new_v4(),
            user_id: 4,
            order_type: OrderType::Limit,
            side: OrderSide::Buy,
            price: dec!(102),
            quantity: dec!(12), // Will fill 5@100, 5@101, and 2@102
            timestamp: Utc::now(),
        };
        let (trades, deltas) = engine.add_order(buy_order.clone());

        assert_eq!(trades.len(), 3);
        assert_eq!(trades[0].price, dec!(100));
        assert_eq!(trades[0].quantity, dec!(5));
        assert_eq!(trades[1].price, dec!(101));
        assert_eq!(trades[1].quantity, dec!(5));
        assert_eq!(trades[2].price, dec!(102));
        assert_eq!(trades[2].quantity, dec!(2));

        assert_eq!(deltas.len(), 3);
        // Deltas for deleted sell orders
        assert_eq!(deltas[0].action, DeltaAction::Delete);
        assert_eq!(deltas[0].price, dec!(100));
        assert_eq!(deltas[1].action, DeltaAction::Delete);
        assert_eq!(deltas[1].price, dec!(101));
        assert_eq!(deltas[2].action, DeltaAction::Update); // Partial fill at 102
        assert_eq!(deltas[2].price, dec!(102));
        assert_eq!(deltas[2].new_quantity, dec!(3)); // 5 - 2 = 3 remaining

        let snapshot = engine.get_order_book_snapshot();
        assert_eq!(snapshot.asks.len(), 1);
        assert_eq!(snapshot.asks[0].price, dec!(102));
        assert_eq!(snapshot.asks[0].quantity, dec!(3));
        assert!(snapshot.bids.is_empty());
        assert_eq!(engine.get_last_traded_price(), Some(dec!(102)));
    }

    #[test]
    fn test_complex_scenario_add_cancel_match() {
        let mut engine = setup();

        // Add some initial orders
        let sell_100_q10 = Order {
            id: Uuid::new_v4(),
            user_id: 1,
            order_type: OrderType::Limit,
            side: OrderSide::Sell,
            price: dec!(100),
            quantity: dec!(10),
            timestamp: Utc::now(),
        };
        let sell_101_q5 = Order {
            id: Uuid::new_v4(),
            user_id: 2,
            order_type: OrderType::Limit,
            side: OrderSide::Sell,
            price: dec!(101),
            quantity: dec!(5),
            timestamp: Utc::now(),
        };
        let buy_99_q15 = Order {
            id: Uuid::new_v4(),
            user_id: 3,
            order_type: OrderType::Limit,
            side: OrderSide::Buy,
            price: dec!(99),
            quantity: dec!(15),
            timestamp: Utc::now(),
        };

        engine.add_order(sell_100_q10.clone());
        engine.add_order(sell_101_q5.clone());
        engine.add_order(buy_99_q15.clone());

        // Snapshot after initial orders
        let snapshot_1 = engine.get_order_book_snapshot();
        assert_eq!(snapshot_1.bids.len(), 1);
        assert_eq!(snapshot_1.bids[0].price, dec!(99));
        assert_eq!(snapshot_1.bids[0].quantity, dec!(15));
        assert_eq!(snapshot_1.asks.len(), 2);
        assert_eq!(snapshot_1.asks[0].price, dec!(100));
        assert_eq!(snapshot_1.asks[0].quantity, dec!(10));
        assert_eq!(snapshot_1.asks[1].price, dec!(101));
        assert_eq!(snapshot_1.asks[1].quantity, dec!(5));

        // Cancel sell_100_q10
        let (cancel_result, cancel_deltas) = engine.cancel_order(sell_100_q10.id);
        assert!(cancel_result.is_ok());
        assert_eq!(cancel_deltas.len(), 1);
        assert_eq!(cancel_deltas[0].action, DeltaAction::Delete);
        assert_eq!(cancel_deltas[0].price, dec!(100));

        // Snapshot after cancellation
        let snapshot_2 = engine.get_order_book_snapshot();
        assert_eq!(snapshot_2.asks.len(), 1);
        assert_eq!(snapshot_2.asks[0].price, dec!(101));
        assert_eq!(snapshot_2.asks[0].quantity, dec!(5));

        // Add a new buy order that matches sell_101_q5
        let buy_101_q5 = Order {
            id: Uuid::new_v4(),
            user_id: 4,
            order_type: OrderType::Limit,
            side: OrderSide::Buy,
            price: dec!(101),
            quantity: dec!(5),
            timestamp: Utc::now(),
        };
        let (trades, match_deltas) = engine.add_order(buy_101_q5.clone());

        assert_eq!(trades.len(), 1);
        assert_eq!(trades[0].price, dec!(101));
        assert_eq!(trades[0].quantity, dec!(5));

        assert_eq!(match_deltas.len(), 1);
        assert_eq!(match_deltas[0].action, DeltaAction::Delete);
        assert_eq!(match_deltas[0].price, dec!(101));

        // Final snapshot
        let snapshot_3 = engine.get_order_book_snapshot();
        assert!(snapshot_3.asks.is_empty());
        assert_eq!(snapshot_3.bids.len(), 1);
        assert_eq!(snapshot_3.bids[0].price, dec!(99));
        assert_eq!(snapshot_3.bids[0].quantity, dec!(15));
        assert_eq!(engine.get_last_traded_price(), Some(dec!(101)));
    }

    #[test]
    fn test_order_id_uniqueness() {
        let mut engine = setup();
        let order1 = Order {
            id: Uuid::new_v4(),
            user_id: 1,
            order_type: OrderType::Limit,
            side: OrderSide::Buy,
            price: dec!(100),
            quantity: dec!(10),
            timestamp: Utc::now(),
        };
        let order2 = Order {
            id: Uuid::new_v4(),
            user_id: 2,
            order_type: OrderType::Limit,
            side: OrderSide::Buy,
            price: dec!(100),
            quantity: dec!(10),
            timestamp: Utc::now(),
        };

        engine.add_order(order1.clone());
        engine.add_order(order2.clone());

        let snapshot = engine.get_order_book_snapshot();
        assert_eq!(snapshot.bids.len(), 1); // Should still be one price level
        assert_eq!(snapshot.bids[0].quantity, dec!(20)); // Total quantity should be 20
    }

    #[test]
    fn test_price_level_order_priority_fifo() {
        let mut engine = setup();
        let order1 = Order {
            id: Uuid::new_v4(),
            user_id: 1,
            order_type: OrderType::Limit,
            side: OrderSide::Sell,
            price: dec!(100),
            quantity: dec!(5),
            timestamp: Utc::now(),
        };
        std::thread::sleep(std::time::Duration::from_millis(2)); // Ensure different timestamps
        let order2 = Order {
            id: Uuid::new_v4(),
            user_id: 2,
            order_type: OrderType::Limit,
            side: OrderSide::Sell,
            price: dec!(100),
            quantity: dec!(5),
            timestamp: Utc::now(),
        };
        engine.add_order(order1.clone());
        engine.add_order(order2.clone());

        let buy_order = Order {
            id: Uuid::new_v4(),
            user_id: 3,
            order_type: OrderType::Limit,
            side: OrderSide::Buy,
            price: dec!(100),
            quantity: dec!(7),
            timestamp: Utc::now(),
        };
        let (trades, _) = engine.add_order(buy_order.clone());

        assert_eq!(trades.len(), 2);
        assert_eq!(trades[0].maker_order_id, order1.id); // order1 should be filled first (FIFO)
        assert_eq!(trades[0].quantity, dec!(5));
        assert_eq!(trades[1].maker_order_id, order2.id);
        assert_eq!(trades[1].quantity, dec!(2)); // Remaining 2 from order2
    }

    #[test]
    fn test_market_order_with_insufficient_liquidity() {
        let mut engine = setup();
        let sell_order = Order {
            id: Uuid::new_v4(),
            user_id: 1,
            order_type: OrderType::Limit,
            side: OrderSide::Sell,
            price: dec!(100),
            quantity: dec!(5),
            timestamp: Utc::now(),
        };
        engine.add_order(sell_order.clone());

        let buy_market_order = Order {
            id: Uuid::new_v4(),
            user_id: 2,
            order_type: OrderType::Market,
            side: OrderSide::Buy,
            price: dec!(0),
            quantity: dec!(10), // More than available liquidity
            timestamp: Utc::now(),
        };
        let (trades, deltas) = engine.add_order(buy_market_order.clone());

        assert_eq!(trades.len(), 1);
        assert_eq!(trades[0].price, dec!(100));
        assert_eq!(trades[0].quantity, dec!(5)); // Only 5 filled

        assert_eq!(deltas.len(), 1);
        assert_eq!(deltas[0].action, DeltaAction::Delete);
        assert_eq!(deltas[0].side, OrderSide::Sell);
        assert_eq!(deltas[0].price, dec!(100));
        assert_eq!(deltas[0].new_quantity, dec!(0));

        let snapshot = engine.get_order_book_snapshot();
        assert!(snapshot.asks.is_empty());
        assert_eq!(engine.get_last_traded_price(), Some(dec!(100)));
    }

    #[test]
    fn test_limit_order_crosses_spread_and_rests() {
        let mut engine = setup();
        let sell_order = Order {
            id: Uuid::new_v4(),
            user_id: 1,
            order_type: OrderType::Limit,
            side: OrderSide::Sell,
            price: dec!(105),
            quantity: dec!(10),
            timestamp: Utc::now(),
        };
        engine.add_order(sell_order.clone());

        let buy_order = Order {
            id: Uuid::new_v4(),
            user_id: 2,
            order_type: OrderType::Limit,
            side: OrderSide::Buy,
            price: dec!(110), // Price higher than existing sell
            quantity: dec!(15),
            timestamp: Utc::now(),
        };
        let (trades, deltas) = engine.add_order(buy_order.clone());

        assert_eq!(trades.len(), 1);
        assert_eq!(trades[0].price, dec!(105));
        assert_eq!(trades[0].quantity, dec!(10));

        assert_eq!(deltas.len(), 2);
        assert_eq!(deltas[0].action, DeltaAction::Delete);
        assert_eq!(deltas[0].side, OrderSide::Sell);
        assert_eq!(deltas[0].price, dec!(105));

        assert_eq!(deltas[1].action, DeltaAction::New); // Remaining buy order rests
        assert_eq!(deltas[1].side, OrderSide::Buy);
        assert_eq!(deltas[1].price, dec!(110));
        assert_eq!(deltas[1].new_quantity, dec!(5));

        let snapshot = engine.get_order_book_snapshot();
        assert_eq!(snapshot.bids.len(), 1);
        assert_eq!(snapshot.bids[0].price, dec!(110));
        assert_eq!(snapshot.bids[0].quantity, dec!(5));
        assert!(snapshot.asks.is_empty());
        assert_eq!(engine.get_last_traded_price(), Some(dec!(105)));
    }

    #[test]
    fn test_order_book_empty_after_all_matches() {
        let mut engine = setup();
        let sell_order = Order {
            id: Uuid::new_v4(),
            user_id: 1,
            order_type: OrderType::Limit,
            side: OrderSide::Sell,
            price: dec!(100),
            quantity: dec!(10),
            timestamp: Utc::now(),
        };
        let buy_order = Order {
            id: Uuid::new_v4(),
            user_id: 2,
            order_type: OrderType::Limit,
            side: OrderSide::Buy,
            price: dec!(100),
            quantity: dec!(10),
            timestamp: Utc::now(),
        };

        engine.add_order(sell_order.clone());
        engine.add_order(buy_order.clone());

        let snapshot = engine.get_order_book_snapshot();
        assert!(snapshot.bids.is_empty());
        assert!(snapshot.asks.is_empty());
    }

    #[test]
    fn test_cancel_order_updates_total_quantity() {
        let mut engine = setup();
        let order1 = Order {
            id: Uuid::new_v4(),
            user_id: 1,
            order_type: OrderType::Limit,
            side: OrderSide::Buy,
            price: dec!(100),
            quantity: dec!(10),
            timestamp: Utc::now(),
        };
        let order2 = Order {
            id: Uuid::new_v4(),
            user_id: 2,
            order_type: OrderType::Limit,
            side: OrderSide::Buy,
            price: dec!(100),
            quantity: dec!(5),
            timestamp: Utc::now(),
        };
        engine.add_order(order1.clone());
        engine.add_order(order2.clone());

        let snapshot_before = engine.get_order_book_snapshot();
        assert_eq!(snapshot_before.bids[0].quantity, dec!(15));

        engine.cancel_order(order1.id);

        let snapshot_after = engine.get_order_book_snapshot();
        assert_eq!(snapshot_after.bids[0].quantity, dec!(5));
    }

    #[test]
    fn test_market_order_fills_at_best_available_price() {
        let mut engine = setup();
        engine.add_order(Order {
            id: Uuid::new_v4(),
            user_id: 1,
            order_type: OrderType::Limit,
            side: OrderSide::Sell,
            price: dec!(102),
            quantity: dec!(5),
            timestamp: Utc::now(),
        });
        engine.add_order(Order {
            id: Uuid::new_v4(),
            user_id: 2,
            order_type: OrderType::Limit,
            side: OrderSide::Sell,
            price: dec!(100),
            quantity: dec!(5),
            timestamp: Utc::now(),
        }); // Best ask

        let buy_market_order = Order {
            id: Uuid::new_v4(),
            user_id: 3,
            order_type: OrderType::Market,
            side: OrderSide::Buy,
            price: dec!(0),
            quantity: dec!(5),
            timestamp: Utc::now(),
        };
        let (trades, _) = engine.add_order(buy_market_order.clone());

        assert_eq!(trades.len(), 1);
        assert_eq!(trades[0].price, dec!(100)); // Should fill at 100, not 102
        assert_eq!(trades[0].quantity, dec!(5));
    }

    #[test]
    fn test_limit_order_does_not_match_if_outside_spread() {
        let mut engine = setup();
        engine.add_order(Order {
            id: Uuid::new_v4(),
            user_id: 1,
            order_type: OrderType::Limit,
            side: OrderSide::Sell,
            price: dec!(105),
            quantity: dec!(10),
            timestamp: Utc::now(),
        });
        engine.add_order(Order {
            id: Uuid::new_v4(),
            user_id: 2,
            order_type: OrderType::Limit,
            side: OrderSide::Buy,
            price: dec!(95),
            quantity: dec!(10),
            timestamp: Utc::now(),
        });

        let buy_order_no_match = Order {
            id: Uuid::new_v4(),
            user_id: 3,
            order_type: OrderType::Limit,
            side: OrderSide::Buy,
            price: dec!(100), // Between 95 and 105, but no matching sell at 100
            quantity: dec!(5),
            timestamp: Utc::now(),
        };
        let (trades, deltas) = engine.add_order(buy_order_no_match.clone());

        assert!(trades.is_empty());
        assert_eq!(deltas.len(), 1);
        assert_eq!(deltas[0].action, DeltaAction::New);
        assert_eq!(deltas[0].side, OrderSide::Buy);
        assert_eq!(deltas[0].price, dec!(100));
        assert_eq!(deltas[0].new_quantity, dec!(5));

        let snapshot = engine.get_order_book_snapshot();
        assert_eq!(snapshot.bids.len(), 2);
        assert_eq!(snapshot.bids[0].price, dec!(100));
        assert_eq!(snapshot.bids[0].quantity, dec!(5));
        assert_eq!(snapshot.bids[1].price, dec!(95));
        assert_eq!(snapshot.bids[1].quantity, dec!(10));
        assert_eq!(snapshot.asks.len(), 1);
        assert_eq!(snapshot.asks[0].price, dec!(105));
        assert_eq!(snapshot.asks[0].quantity, dec!(10));
    }

    #[test]
    fn test_inverted_order_book_scenario() {
        let mut engine = setup();

        // Add a sell order at 50010
        let sell_order = Order {
            id: Uuid::new_v4(),
            user_id: 1,
            order_type: OrderType::Limit,
            side: OrderSide::Sell,
            price: dec!(50010),
            quantity: dec!(10),
            timestamp: Utc::now(),
        };
        engine.add_order(sell_order.clone());

        // Add a buy order at 50050
        let buy_order = Order {
            id: Uuid::new_v4(),
            user_id: 2,
            order_type: OrderType::Limit,
            side: OrderSide::Buy,
            price: dec!(50050),
            quantity: dec!(10),
            timestamp: Utc::now(),
        };
        let (trades, deltas) = engine.add_order(buy_order.clone());

        // Expect a trade to occur and the order book to be empty
        assert_eq!(trades.len(), 1);
        assert_eq!(trades[0].price, dec!(50010)); // Trade should occur at the sell order's price
        assert_eq!(trades[0].quantity, dec!(10));

        let snapshot = engine.get_order_book_snapshot();
        assert!(snapshot.bids.is_empty());
        assert!(snapshot.asks.is_empty());
    }

    #[test]
    fn test_order_book_empty_after_all_matches() {
        let mut engine = setup();
        let sell_order = Order {
            id: Uuid::new_v4(),
            user_id: 1,
            order_type: OrderType::Limit,
            side: OrderSide::Sell,
            price: dec!(100),
            quantity: dec!(10),
            timestamp: Utc::now(),
        };
        let buy_order = Order {
            id: Uuid::new_v4(),
            user_id: 2,
            order_type: OrderType::Limit,
            side: OrderSide::Buy,
            price: dec!(100),
            quantity: dec!(10),
            timestamp: Utc::now(),
        };

        engine.add_order(sell_order.clone());
        engine.add_order(buy_order.clone());

        let snapshot = engine.get_order_book_snapshot();
        assert!(snapshot.bids.is_empty());
        assert!(snapshot.asks.is_empty());
    }

    #[test]
    fn test_cancel_order_updates_total_quantity() {
        let mut engine = setup();
        let order1 = Order {
            id: Uuid::new_v4(),
            user_id: 1,
            order_type: OrderType::Limit,
            side: OrderSide::Buy,
            price: dec!(100),
            quantity: dec!(10),
            timestamp: Utc::now(),
        };
        let order2 = Order {
            id: Uuid::new_v4(),
            user_id: 2,
            order_type: OrderType::Limit,
            side: OrderSide::Buy,
            price: dec!(100),
            quantity: dec!(5),
            timestamp: Utc::now(),
        };
        engine.add_order(order1.clone());
        engine.add_order(order2.clone());

        let snapshot_before = engine.get_order_book_snapshot();
        assert_eq!(snapshot_before.bids[0].quantity, dec!(15));

        engine.cancel_order(order1.id);

        let snapshot_after = engine.get_order_book_snapshot();
        assert_eq!(snapshot_after.bids[0].quantity, dec!(5));
    }

    #[test]
    fn test_market_order_fills_at_best_available_price() {
        let mut engine = setup();
        engine.add_order(Order {
            id: Uuid::new_v4(),
            user_id: 1,
            order_type: OrderType::Limit,
            side: OrderSide::Sell,
            price: dec!(102),
            quantity: dec!(5),
            timestamp: Utc::now(),
        });
        engine.add_order(Order {
            id: Uuid::new_v4(),
            user_id: 2,
            order_type: OrderType::Limit,
            side: OrderSide::Sell,
            price: dec!(100),
            quantity: dec!(5),
            timestamp: Utc::now(),
        }); // Best ask

        let buy_market_order = Order {
            id: Uuid::new_v4(),
            user_id: 3,
            order_type: OrderType::Market,
            side: OrderSide::Buy,
            price: dec!(0),
            quantity: dec!(5),
            timestamp: Utc::now(),
        };
        let (trades, _) = engine.add_order(buy_market_order.clone());

        assert_eq!(trades.len(), 1);
        assert_eq!(trades[0].price, dec!(100)); // Should fill at 100, not 102
        assert_eq!(trades[0].quantity, dec!(5));
    }

    #[test]
    fn test_limit_order_does_not_match_if_outside_spread() {
        let mut engine = setup();
        engine.add_order(Order {
            id: Uuid::new_v4(),
            user_id: 1,
            order_type: OrderType::Limit,
            side: OrderSide::Sell,
            price: dec!(105),
            quantity: dec!(10),
            timestamp: Utc::now(),
        });
        engine.add_order(Order {
            id: Uuid::new_v4(),
            user_id: 2,
            order_type: OrderType::Limit,
            side: OrderSide::Buy,
            price: dec!(95),
            quantity: dec!(10),
            timestamp: Utc::now(),
        });

        let buy_order_no_match = Order {
            id: Uuid::new_v4(),
            user_id: 3,
            order_type: OrderType::Limit,
            side: OrderSide::Buy,
            price: dec!(100), // Between 95 and 105, but no matching sell at 100
            quantity: dec!(5),
            timestamp: Utc::now(),
        };
        let (trades, deltas) = engine.add_order(buy_order_no_match.clone());

        assert!(trades.is_empty());
        assert_eq!(deltas.len(), 1);
        assert_eq!(deltas[0].action, DeltaAction::New);
        assert_eq!(deltas[0].side, OrderSide::Buy);
        assert_eq!(deltas[0].price, dec!(100));
        assert_eq!(deltas[0].new_quantity, dec!(5));

        let snapshot = engine.get_order_book_snapshot();
        assert_eq!(snapshot.bids.len(), 2);
        assert_eq!(snapshot.bids[0].price, dec!(100));
        assert_eq!(snapshot.bids[0].quantity, dec!(5));
        assert_eq!(snapshot.bids[1].price, dec!(95));
        assert_eq!(snapshot.bids[1].quantity, dec!(10));
        assert_eq!(snapshot.asks.len(), 1);
        assert_eq!(snapshot.asks[0].price, dec!(105));
        assert_eq!(snapshot.asks[0].quantity, dec!(10));
    }
}