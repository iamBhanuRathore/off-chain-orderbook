// import { PrismaClient } from "@/generated/prisma";
// import { faker } from "@faker-js/faker";

// const prisma = new PrismaClient();
// const DEFAULT_DECIMALS = {
//   USDT: 6,
//   USDC: 6,
//   USD: 6,
//   INR: 6,
//   BTC: 8,
//   ETH: 8,
//   LTC: 8,
//   SOL: 8,
// };

// type Asset = keyof typeof DEFAULT_DECIMALS;

// type MarketeConfig = {
//   symbol: string;
//   base_asset: Asset;
//   quote_asset: Asset;
//   enabled: boolean;
// };

// const marketConfigs: MarketeConfig[] = [
//   { symbol: "BTC/INR", base_asset: "BTC", quote_asset: "INR", enabled: true },
//   { symbol: "ETH/USD", base_asset: "ETH", quote_asset: "USD", enabled: true },
//   { symbol: "LTC/BTC", base_asset: "LTC", quote_asset: "BTC", enabled: true },
//   { symbol: "SOL/USDT", base_asset: "SOL", quote_asset: "USDT", enabled: true },
//   { symbol: "SOL/USDC", base_asset: "SOL", quote_asset: "USDC", enabled: true },
// ];

// async function seedAssets() {
//   const assets = new Set<Asset>();
//   marketConfigs.forEach((m) => {
//     assets.add(m.base_asset);
//     assets.add(m.quote_asset);
//   });

//   for (const symbol of assets) {
//     const decimals = DEFAULT_DECIMALS[symbol] || 8;
//     await prisma.asset.upsert({
//       where: { symbol },
//       update: {},
//       create: {
//         symbol,
//         name: faker.finance.currencyName(),
//         decimals,
//       },
//     });
//   }
// }

// async function seedMarketsAndFees() {
//   for (const m of marketConfigs) {
//     const marketSymbol = m.symbol.replace("/", "_");
//     console.log({ marketSymbol });

//     // First create the fee record
//     await prisma.fee.upsert({
//       where: { market: marketSymbol },
//       update: {},
//       create: {
//         market: marketSymbol,
//         makerFeeBps: 2 + Math.floor(Math.random() * 5), // 2 - 6 bps
//         takerFeeBps: 5 + Math.floor(Math.random() * 10), // 5 - 15 bps
//       },
//     });

//     // Then create the market record
//     await prisma.market.upsert({
//       where: { symbol: marketSymbol },
//       update: {},
//       create: {
//         symbol: marketSymbol,
//         baseAsset: m.base_asset,
//         quoteAsset: m.quote_asset,
//         minPrice: 0.01,
//         maxPrice: 1_000_000,
//         tickSize: 0.01,
//         minQuantity: 0.0001,
//         maxQuantity: 1_000,
//         stepSize: 0.0001,
//         isActive: m.enabled,
//       },
//     });
//   }
// }

// async function seedUsersAndBalances(count: number = 5) {
//   const assets = await prisma.asset.findMany();

//   for (let i = 0; i < count; i++) {
//     const user = await prisma.user.create({
//       data: {
//         email: faker.internet.email().toLowerCase(),
//         password: faker.internet.password(),
//       },
//     });

//     for (const asset of assets) {
//       const shouldSeed = Math.random() < 0.7;
//       if (!shouldSeed) continue;

//       const amount = BigInt(Math.floor(Math.random() * 10 ** asset.decimals * 10));
//       const locked = BigInt(Math.floor(Number(amount) * 0.1));

//       await prisma.balance.create({
//         data: {
//           userId: user.id,
//           asset: asset.symbol,
//           amount,
//           locked,
//           decimal: asset.decimals,
//         },
//       });
//     }
//   }
// }

// async function main() {
//   console.log("🌱 Seeding DB...");
//   await seedAssets();
//   console.log("✅ Assets seeded.");
//   await seedMarketsAndFees();
//   console.log("✅ Markets and Fees seeded.");
//   await seedUsersAndBalances(10);
//   console.log("✅ Seeding complete!");
// }

// main()
//   .catch((e) => {
//     console.error("❌ Seed failed:", e);
//     process.exit(1);
//   })
//   .finally(() => prisma.$disconnect());

// TODO: New function to seed orders
import {
  PrismaClient,
  Side,
  OrderStatus,
  OrderType,
  TimeInForce,
  TransactionType,
  CandlestickInterval,
} from "@/generated/prisma";
import { faker } from "@faker-js/faker";
import { Decimal } from "@prisma/client/runtime/library";

const prisma = new PrismaClient();
const DEFAULT_DECIMALS = {
  USDT: 6,
  USDC: 6,
  USD: 6,
  INR: 6,
  BTC: 8,
  ETH: 8,
  LTC: 8,
  SOL: 8,
};

type Asset = keyof typeof DEFAULT_DECIMALS;

type MarketeConfig = {
  symbol: string;
  base_asset: Asset;
  quote_asset: Asset;
  enabled: boolean;
};

const marketConfigs: MarketeConfig[] = [
  { symbol: "BTC/INR", base_asset: "BTC", quote_asset: "INR", enabled: true },
  { symbol: "ETH/USD", base_asset: "ETH", quote_asset: "USD", enabled: true },
  { symbol: "LTC/BTC", base_asset: "LTC", quote_asset: "BTC", enabled: true },
  { symbol: "SOL/USDT", base_asset: "SOL", quote_asset: "USDT", enabled: true },
  { symbol: "SOL/USDC", base_asset: "SOL", quote_asset: "USDC", enabled: true },
];

async function seedAssets() {
  const assets = new Set<Asset>();
  marketConfigs.forEach((m) => {
    assets.add(m.base_asset);
    assets.add(m.quote_asset);
  });

  for (const symbol of assets) {
    const decimals = DEFAULT_DECIMALS[symbol] || 8;
    await prisma.asset.upsert({
      where: { symbol },
      update: {},
      create: {
        symbol,
        name: faker.finance.currencyName(),
        decimals,
      },
    });
  }
}

async function seedMarketsAndFees() {
  for (const m of marketConfigs) {
    const marketSymbol = m.symbol.replace("/", "_");
    console.log({ marketSymbol });

    // First create the fee record
    await prisma.fee.upsert({
      where: { market: marketSymbol },
      update: {},
      create: {
        market: marketSymbol,
        makerFeeBps: 2 + Math.floor(Math.random() * 5), // 2 - 6 bps
        takerFeeBps: 5 + Math.floor(Math.random() * 10), // 5 - 15 bps
      },
    });

    // Then create the market record
    await prisma.market.upsert({
      where: { symbol: marketSymbol },
      update: {},
      create: {
        symbol: marketSymbol,
        baseAsset: m.base_asset,
        quoteAsset: m.quote_asset,
        minPrice: 0.01,
        maxPrice: 1_000_000,
        tickSize: 0.01,
        minQuantity: 0.0001,
        maxQuantity: 1_000,
        stepSize: 0.0001,
        isActive: m.enabled,
      },
    });
  }
}

async function seedUsersAndBalances(count: number = 5) {
  const assets = await prisma.asset.findMany();

  for (let i = 0; i < count; i++) {
    const user = await prisma.user.create({
      data: {
        email: faker.internet.email().toLowerCase(),
        password: faker.internet.password(),
      },
    });

    for (const asset of assets) {
      const shouldSeed = Math.random() < 0.7;
      if (!shouldSeed) continue;

      const amount = BigInt(
        Math.floor(Math.random() * 10 ** asset.decimals * 10),
      );
      const locked = BigInt(Math.floor(Number(amount) * 0.1));

      await prisma.balance.create({
        data: {
          userId: user.id,
          asset: asset.symbol,
          amount,
          locked,
          decimal: asset.decimals,
        },
      });
    }
  }
}

async function seedOrdersAndTrades(
  orderCount: number = 20,
  tradeCount: number = 10,
) {
  const users = await prisma.user.findMany();
  const markets = await prisma.market.findMany();

  if (users.length === 0 || markets.length === 0) {
    console.log("⚠️ Cannot seed orders and trades without users and markets.");
    return;
  }

  const orders = [];
  for (let i = 0; i < orderCount; i++) {
    const user = faker.helpers.arrayElement(users);
    const market = faker.helpers.arrayElement(markets);
    const side = faker.helpers.arrayElement([Side.Buy, Side.Sell]);
    const orderType = faker.helpers.arrayElement([
      OrderType.Limit,
      OrderType.Market,
    ]);
    const status = faker.helpers.arrayElement([
      OrderStatus.Open,
      OrderStatus.PartiallyFilled,
      OrderStatus.Filled,
      OrderStatus.Canceled,
    ]);
    const price = new Decimal(
      faker.finance.amount(Number(market.minPrice), Number(market.maxPrice), 4),
    );
    const quantity = new Decimal(
      faker.finance.amount(
        Number(market.minQuantity),
        Number(market.maxQuantity),
        4,
      ),
    );
    const filled =
      status === OrderStatus.Filled
        ? quantity
        : new Decimal(faker.finance.amount(0, Number(quantity), 4));
    const remaining = quantity.minus(filled);

    const order = await prisma.order.create({
      data: {
        userId: user.id,
        market: market.symbol,
        price: price,
        quantity: quantity,
        filled: filled,
        remaining: remaining,
        side: side,
        status: status,
        orderType: orderType,
        timeInForce: TimeInForce.GTC,
        createdAt: faker.date.past(),
      },
    });
    orders.push(order);
  }

  for (let i = 0; i < tradeCount; i++) {
    const market = faker.helpers.arrayElement(markets);
    const buyOrders = orders.filter(
      (o) =>
        o.market === market.symbol &&
        o.side === Side.Buy &&
        o.status !== OrderStatus.Canceled,
    );
    const sellOrders = orders.filter(
      (o) =>
        o.market === market.symbol &&
        o.side === Side.Sell &&
        o.status !== OrderStatus.Canceled,
    );

    if (buyOrders.length > 0 && sellOrders.length > 0) {
      const buyOrder = faker.helpers.arrayElement(buyOrders);
      const sellOrder = faker.helpers.arrayElement(sellOrders);
      const quantity = new Decimal(
        Math.min(Number(buyOrder.remaining), Number(sellOrder.remaining)),
      ).toDP(4);
      const price = faker.helpers.arrayElement([
        buyOrder.price,
        sellOrder.price,
      ]);

      if (quantity.isZero()) continue;

      await prisma.trade.create({
        data: {
          market: market.symbol,
          price: price,
          quantity: quantity,
          takerSide: faker.helpers.arrayElement([Side.Buy, Side.Sell]),
          buyOrderId: buyOrder.id,
          sellOrderId: sellOrder.id,
          buyerId: buyOrder.userId,
          sellerId: sellOrder.userId,
          fee: BigInt(faker.number.int({ min: 100, max: 1000 })),
          feeAsset: market.quoteAsset,
          timestamp: faker.date.recent(),
        },
      });
    }
  }
}

async function seedTransactions(transactionCount: number = 50) {
  const users = await prisma.user.findMany();
  const assets = await prisma.asset.findMany();

  if (users.length === 0 || assets.length === 0) {
    console.log("⚠️ Cannot seed transactions without users and assets.");
    return;
  }

  for (let i = 0; i < transactionCount; i++) {
    const user = faker.helpers.arrayElement(users);
    const asset = faker.helpers.arrayElement(assets);
    const type = faker.helpers.arrayElement([
      TransactionType.Deposit,
      TransactionType.Withdrawal,
    ]);
    const amount = new Decimal(faker.finance.amount(1, 1000, 6));

    await prisma.transaction.create({
      data: {
        userId: user.id,
        asset: asset.symbol,
        type: type,
        amount: amount,
        balance: new Decimal(0), // This would ideally be calculated
        status: "Completed",
        timestamp: faker.date.past(),
      },
    });
  }
}

async function seedMarketStats(days: number = 30) {
  const markets = await prisma.market.findMany();
  if (markets.length === 0) {
    console.log("⚠️ Cannot seed market stats without markets.");
    return;
  }

  for (const market of markets) {
    for (let i = 0; i < days; i++) {
      const date = faker.date.recent({ days: i });
      const open = new Decimal(
        faker.finance.amount(
          Number(market.minPrice),
          Number(market.maxPrice),
          4,
        ),
      );
      const high = open.plus(new Decimal(faker.finance.amount(0, 100, 4)));
      const low = open.minus(new Decimal(faker.finance.amount(0, 100, 4)));
      const close = faker.helpers.arrayElement([high, low, open]);

      await prisma.marketStats.create({
        data: {
          market: market.symbol,
          timestamp: date,
          lastPrice: close,
          volume24h: new Decimal(faker.finance.amount(1000, 1000000, 4)),
          high24h: high,
          low24h: low.isPositive() ? low : new Decimal(0),
          priceChange24h: close.minus(open),
          priceChangePercent24h: close.minus(open).dividedBy(open).times(100),
          bidPrice: close.minus(new Decimal(faker.finance.amount(0, 1, 4))),
          askPrice: close.plus(new Decimal(faker.finance.amount(0, 1, 4))),
          spread: new Decimal(faker.finance.amount(0, 2, 4)),
        },
      });
    }
  }
}

async function seedCandlesticks(days: number = 90) {
  const markets = await prisma.market.findMany();
  if (markets.length === 0) {
    console.log("⚠️ Cannot seed candlesticks without markets.");
    return;
  }
  const intervals = [CandlestickInterval.H1, CandlestickInterval.D1];

  for (const market of markets) {
    for (const interval of intervals) {
      let openTime = new Date();
      openTime.setDate(openTime.getDate() - days);

      for (
        let i = 0;
        i < days * (interval === CandlestickInterval.D1 ? 1 : 24);
        i++
      ) {
        const open = new Decimal(
          faker.finance.amount(
            Number(market.minPrice),
            Number(market.maxPrice),
            4,
          ),
        );
        const high = open.plus(new Decimal(faker.finance.amount(0, 100, 4)));
        const low = open.minus(new Decimal(faker.finance.amount(0, 100, 4)));
        const close = faker.helpers.arrayElement([high, low, open]);
        const volume = new Decimal(faker.finance.amount(1, 10000, 4));

        const closeTime = new Date(openTime);
        if (interval === CandlestickInterval.D1) {
          closeTime.setDate(openTime.getDate() + 1);
        } else {
          closeTime.setHours(openTime.getHours() + 1);
        }

        await prisma.candlestick.create({
          data: {
            market: market.symbol,
            interval: interval,
            openTime: openTime,
            closeTime: closeTime,
            open: open,
            high: high,
            low: low.isPositive() ? low : new Decimal(0),
            close: close,
            volume: volume,
            trades: faker.number.int({ min: 1, max: 500 }),
          },
        });
        openTime = closeTime;
      }
    }
  }
}

async function main() {
  console.log("🌱 Seeding DB...");
  await seedAssets();
  console.log("✅ Assets seeded.");
  await seedMarketsAndFees();
  console.log("✅ Markets and Fees seeded.");
  await seedUsersAndBalances(10);
  console.log("✅ Users and Balances seeded.");
  await seedOrdersAndTrades(100, 50);
  console.log("✅ Orders and Trades seeded.");
  await seedTransactions(200);
  console.log("✅ Transactions seeded.");
  await seedMarketStats(30);
  console.log("✅ Market Stats seeded.");
  await seedCandlesticks(90);
  console.log("✅ Candlesticks seeded.");
  console.log("✅ Seeding complete!");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
