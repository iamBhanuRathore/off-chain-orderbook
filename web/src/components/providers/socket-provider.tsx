"use client";
import React from "react";
import { createContext, useContext, useEffect, useState } from "react";
import { io as ClientIO } from "socket.io-client";

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
  const [socket, setSocket] = useState(null);
  const [isConnected, setisConnected] = useState(false);
  useEffect(() => {
    const socketInstance = new (ClientIO as any)(process.env.NEXT_PUBLIC_SITE_URL!, {
      path: "/api/socket/io",
      addTrailingSlash: false,
    });
    socketInstance.on("connect", () => {
      setisConnected(true);
    });
    socketInstance.on("disconnect", () => {
      setisConnected(false);
    });
    setSocket(socketInstance);
    return () => {
      socketInstance.disconnect();
    };
  }, []);
  return <SocketContext.Provider value={{ socket, isConnected }}>{children}</SocketContext.Provider>;
};
