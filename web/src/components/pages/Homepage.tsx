"use client";
import * as React from "react";
import { OrderBookPanel } from "@/components/OrderBookPanel";
import { OrderFormPanel } from "@/components/OrderFormPanel";
import { UserPortfolioPanel } from "@/components/UserPortfolioPanel";
import { TradingChartPlaceholder } from "@/components/TradingChartPlaceholder";
import type { TradingSymbol } from "@/types";
import { AVAILABLE_SYMBOLS, MOCK_BALANCES } from "@/lib/constants";
import { TopStatsBar } from "@/components/TopStatsBar";
import { motion } from "framer-motion";

export default function TradingDashboardPage() {
  const [selectedSymbol, setSelectedSymbol] = React.useState<TradingSymbol>(AVAILABLE_SYMBOLS[0]);

  const btcBalance = MOCK_BALANCES.find((b) => b.asset === "BTC")?.available || 0;
  const usdBalance = MOCK_BALANCES.find((b) => b.asset === "USD")?.available || 0;

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: "spring",
        stiffness: 120,
        damping: 15,
      },
    },
  };

  return (
    <motion.div className="flex flex-col --doing-this-to-make-this-work-h-[calc(100vh-theme(spacing.16)-theme(spacing.16))] gap-3" variants={containerVariants} initial="hidden" animate="visible">
      <motion.div variants={itemVariants} className="flex-shrink-0">
        <TopStatsBar />
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-10 gap-3 overflow-hidden">
        <motion.div className="lg:col-span-6 xl:col-span-6 flex flex-col h-full" variants={itemVariants}>
          <TradingChartPlaceholder />
        </motion.div>

        <motion.div className="lg:col-span-2 xl:col-span-2 flex flex-col h-full overflow-hidden" variants={itemVariants}>
          <OrderBookPanel selectedSymbol={selectedSymbol} />
        </motion.div>

        <motion.div className="lg:col-span-2 xl:col-span-2 flex flex-col h-full overflow-hidden" variants={itemVariants}>
          <OrderFormPanel selectedSymbol={selectedSymbol} userAvailableBase={btcBalance} userAvailableQuote={usdBalance} />
        </motion.div>
      </div>

      <motion.div className="flex-shrink-0" variants={itemVariants}>
        <UserPortfolioPanel />
      </motion.div>
    </motion.div>
  );
}
