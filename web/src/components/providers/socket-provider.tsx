"use client";

import React from "react";
import { createContext, useContext, useEffect, useState } from "react";
// import { io as ClientIO } from "socket.io-client";

type SocketProviderType = {
  socket: any | null;
  isConnected: boolean;
};

const SocketContext = createContext<SocketProviderType>({
  socket: null,
  isConnected: false,
});

export const useSocket = () => {
  return useContext(SocketContext);
};

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isConnected, setisConnected] = useState(false);
  useEffect(() => {
    const socketInstance = new WebSocket(process.env.SOCKET_SERVER_URL!);
    socketInstance.onopen = () => {
      setisConnected(true);
    };
    socketInstance.onclose = () => {
      setisConnected(false);
    };
    socketInstance.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log("Received message:", data);
    };
    socketInstance.onerror = (error) => {
      console.error("WebSocket error:", error);
    };
    setSocket(socketInstance);
    // const socketInstance = new io(process.env.NEXT_PUBLIC_SITE_URL!, {
    //   path: "/api/socket/io",
    //   addTrailingSlash: false,
    // });
    // socketInstance.on("connect", () => {
    //   setisConnected(true);
    // });
    // socketInstance.on("disconnect", () => {
    //   setisConnected(false);
    // });
    // setSocket(socketInstance);
    return () => {
      socketInstance.close();
    };
  }, []);
  return <SocketContext.Provider value={{ socket, isConnected }}>{children}</SocketContext.Provider>;
};
