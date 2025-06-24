import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "@/styles/globals.css";
import { BrowserRouter } from "react-router-dom";
import { SelectedMarketProvider } from "./components/providers/market-context.tsx";
import { SocketProvider } from "./components/providers/socket-provider.tsx";

createRoot(document.getElementById("root")!).render(
  // <StrictMode>
  <BrowserRouter>
    <SocketProvider>
      <SelectedMarketProvider>
        <App />
      </SelectedMarketProvider>
    </SocketProvider>
  </BrowserRouter>
  // </StrictMode>
);
