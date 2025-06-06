```text
+---------------------+    +---------------------+    +-----------------------+
|     Clients         | -->|     API Gateway     | -->| Order Management Serv.|
| (Web UI, Mobile,    |    |  (REST/WebSocket)   |    |(Validation, Persist)  |
|  Trading Bots)      |    | (Auth, Rate Limit)  |    +-----------+-----------+
+---------------------+    +---------------------+                |
                                                (Validated Orders)|
                                                                   v
                    +---------------------+    +---------------------+    +-----------------------+
                    | Market Data Service |<-- |  Matching Engine    |<-- |   (e.g., Kafka, NATS) |
                    |(Publishes OrderBook |    | (Core Logic -       |    |     Message Queue     |
                    | Updates, Trades)    |    |  Go/Rust recommended)|    |   (for decoupling)    |
                    +--------+------------+    +----------+----------+    +-----------------------+
                             ^                          |  (Matched Trades)
                             |                          |
                (Real-time Feeds)                       v
                    +-----------------------+
                    |    Trade Service      |
                    | (Persist Trades,      |
                    |  Notify Users)        |
                    +-----------+-----------+
                                |
                                | (Settlement Info)
                                v
                    +-----------------------+
                    | Blockchain Interaction|
                    | Service (Settlement,  |
                    | Deposits, Withdrawals)|
                    +-----------+-----------+
                                |
                                v
                    +-----------------------+
                    |   Blockchain Node(s)  |
                    +-----------------------+


Datastores:
- Order Database (e.g., PostgreSQL, MySQL) – For pending & historical orders
- Trade Database (e.g., PostgreSQL, MySQL) – For historical trades
- User Account Database (e.g., PostgreSQL, MySQL) – User info, balances
- In-Memory Store (e.g., Redis) – For live order book state, caching
```
