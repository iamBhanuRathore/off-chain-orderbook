import { createContext, useState, useContext, ReactNode, Dispatch, SetStateAction, useEffect } from "react";
import type { TradingSymbol } from "@/types";
import { AVAILABLE_SYMBOLS } from "@/lib/constants";
// import { useSocket } from "./socket-provider";

type SelectedMarketContextType = {
  selectedSymbol: TradingSymbol;
  // symbolList: TradingSymbol[];
  setSelectedSymbol: Dispatch<SetStateAction<TradingSymbol>>;
};

const SelectedMarketContext = createContext<SelectedMarketContextType | undefined>({
  // symbolList: [],
  selectedSymbol: AVAILABLE_SYMBOLS[0],
  setSelectedSymbol: () => {},
});

export const useSelectedMarket = () => {
  let context = useContext(SelectedMarketContext);
  if (!context) throw new Error("useSelectedMarket must be used within a SelectedMarketProvider");
  return context;
};
export const SelectedMarketProvider = ({ children }: { children: ReactNode }) => {
  // const [symbolList, setSymbolList] = useState([]);
  const [selectedSymbol, setSelectedSymbol] = useState<TradingSymbol>(AVAILABLE_SYMBOLS[0]);
  // const { isConnected, socket } = useSocket();
  // useEffect(() => {
  //   if (isConnected && socket) {
  //     socket.onmessage = (event) => {
  //       const data = JSON.parse(event.data);
  //       if (data.type === "trading_pairs") {
  //         setSymbolList(data.data);
  //         setSelectedSymbol(data.data[0] as TradingSymbol);
  //         return;
  //       }
  //       console.log("Received message:", data);
  //     };
  //   }
  // }, [isConnected, socket]);
  return (
    <SelectedMarketContext.Provider
      value={{
        // symbolList,
        selectedSymbol,
        setSelectedSymbol,
      }}
    >
      {children}
    </SelectedMarketContext.Provider>
  );
};
