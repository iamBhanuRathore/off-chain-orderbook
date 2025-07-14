import { PrismaClient } from "@/generated/prisma";
import { faker } from "@faker-js/faker";

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

      const amount = BigInt(Math.floor(Math.random() * 10 ** asset.decimals * 10));
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

async function main() {
  console.log("🌱 Seeding DB...");
  await seedAssets();
  console.log("✅ Assets seeded.");
  await seedMarketsAndFees();
  console.log("✅ Markets and Fees seeded.");
  await seedUsersAndBalances(10);
  console.log("✅ Seeding complete!");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
