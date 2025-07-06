// Fixed client socket provider with better error handling

"use client";

import { useUser } from "@/components/providers/user-context";
import React, { useCallback, useRef } from "react";
import { createContext, useContext, useEffect, useState } from "react";

type SocketProviderType = {
  socket: WebSocket | null;
  isConnected: boolean;
  isConnecting: boolean;
  connect: () => void;
  disconnect: () => void;
};

const SocketContext = createContext<SocketProviderType>({
  socket: null,
  isConnected: false,
  isConnecting: false,
  connect: () => {},
  disconnect: () => {},
});

export const useSocket = () => {
  return useContext(SocketContext);
};

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const { user } = useUser();
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | number>(0);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  const connect = useCallback(() => {
    if (isConnecting || (socket && socket.readyState === WebSocket.OPEN)) {
      return;
    }

    if (!user) {
      console.log("Cannot connect: No user provided");
      return;
    }

    setIsConnecting(true);

    try {
      // Use fallback URL if environment variable is not set
      const baseUrl = import.meta.env.VITE_SOCKET_SERVER_URL || "ws://localhost:4000";
      console.log("Connecting to:", baseUrl);

      const url = new URL(baseUrl);
      url.searchParams.set("user_id", user);

      console.log("Final WebSocket URL:", url.toString());

      const ws = new WebSocket(url.toString());

      ws.onopen = () => {
        console.log("WebSocket connected");
        setIsConnected(true);
        setIsConnecting(false);
        reconnectAttempts.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log("Received message:", message);

          // Handle authentication errors
          if (message.type === "error" && message.data.type === "authentication_error") {
            console.error("Authentication error:", message.data.message);
            setIsConnecting(false);
            setIsConnected(false);
            ws.close();
            return;
          }
        } catch (error) {
          console.error("Failed to parse WebSocket message:", error);
        }
      };

      ws.onclose = (event) => {
        console.log("WebSocket disconnected:", event.code, event.reason);
        setIsConnected(false);
        setIsConnecting(false);
        setSocket(null);

        // Don't auto-reconnect if it's an authentication error
        if (event.code === 1008) {
          console.log("Authentication failed, not reconnecting");
          return;
        }

        // Auto-reconnect logic
        if (reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
          console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current + 1})`);

          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttempts.current++;
            connect();
          }, delay);
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        setIsConnecting(false);
      };

      setSocket(ws);
    } catch (error) {
      console.error("Failed to create WebSocket connection:", error);
      setIsConnecting(false);
    }
  }, [isConnecting, socket, user]);

  useEffect(() => {
    if (user) {
      connect();
    }

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (socket) {
        socket.close();
      }
    };
  }, [user]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (socket) {
      socket.close();
    }
    setSocket(null);
    setIsConnected(false);
  }, [socket]);

  return <SocketContext.Provider value={{ socket, isConnected, isConnecting, connect, disconnect }}>{children}</SocketContext.Provider>;
};
