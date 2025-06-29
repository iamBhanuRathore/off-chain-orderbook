// import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "@/styles/globals.css";
import { BrowserRouter } from "react-router-dom";
import { SelectedMarketProvider } from "./components/providers/market-context.tsx";
import { SocketProvider } from "./components/providers/socket-provider.tsx";
import { UserProvider } from "./components/providers/user-context.tsx";

createRoot(document.getElementById("root")!).render(
  // <StrictMode>
  <BrowserRouter>
    <SocketProvider>
      <UserProvider>
        <SelectedMarketProvider>
          <App />
        </SelectedMarketProvider>
      </UserProvider>
    </SocketProvider>
  </BrowserRouter>
  // </StrictMode>
);
