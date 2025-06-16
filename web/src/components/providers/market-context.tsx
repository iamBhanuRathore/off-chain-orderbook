import { createContext, useState, useContext, ReactNode, Dispatch, SetStateAction } from "react";
import type { TradingSymbol } from "@/types";
import { AVAILABLE_SYMBOLS } from "@/lib/constants";

type SelectedMarketContextType = {
  selectedSymbol: TradingSymbol;
  setSelectedSymbol: Dispatch<SetStateAction<TradingSymbol>>;
};

const SelectedMarketContext = createContext<SelectedMarketContextType | undefined>({
  selectedSymbol: AVAILABLE_SYMBOLS[0],
  setSelectedSymbol: () => {},
});

export const useSelectedMarket = () => {
  let context = useContext(SelectedMarketContext);
  if (!context) throw new Error("useSelectedMarket must be used within a SelectedMarketProvider");
  return context;
};
export const SelectedMarketProvider = ({ children }: { children: ReactNode }) => {
  const [selectedSymbol, setSelectedSymbol] = useState<TradingSymbol>(AVAILABLE_SYMBOLS[0]);

  return <SelectedMarketContext.Provider value={{ selectedSymbol, setSelectedSymbol }}>{children}</SelectedMarketContext.Provider>;
};
