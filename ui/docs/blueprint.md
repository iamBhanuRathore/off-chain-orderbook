# **App Name**: SwiftTrade

## Core Features:

- APIGateway: API Gateway: Handles request routing, authentication, rate limiting, and basic validation for all incoming API requests.
- OrderIngress: Order Ingress Service: Validates and processes order requests, interacting with the User Balance Service to pre-authorize funds and then publishing orders to Redis.
- MatchingEngine: Matching Engine Service: Consumes orders and cancellations from Redis, maintains an in-memory order book, and generates trades.
- TradePersister: Trade Persister Service: Consumes trades from Redis and persists trade data into PostgreSQL.
- UserBalance: User Balance Service: Manages user balances in PostgreSQL, providing endpoints to lock, unlock, and commit funds for orders and trades.
- MarketData: Market Data Service: Subscribes to order and trade events to provide real-time market data via WebSocket and REST endpoints.

## Style Guidelines:

- Primary color: Deep Indigo (#4B0082) for a sophisticated and reliable feel, reflecting the financial nature of the application.
- Background color: Very light Indigo (#F0F8FF), almost white, providing a clean and neutral backdrop to ensure focus on the trading data.
- Accent color: Violet (#8A2BE2) for interactive elements and highlights, ensuring important features stand out without overwhelming the user.
- Headline font: 'Space Grotesk' (sans-serif) for a computerized, techy feel, used in titles and headers; body font: 'Inter' (sans-serif) for a modern, neutral look in text.
- Use simple, geometric icons for representing order types, market status, and other key actions within the trading platform.
- Employ a clean, modular layout with clear sections for order books, trade history, and user account information. Focus on minimizing visual clutter to improve data accessibility.
- Use subtle transitions and animations for order confirmations, trade executions, and real-time data updates, providing smooth feedback to user interactions.