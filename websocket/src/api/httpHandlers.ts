// src/api/httpHandlers.ts

import { tradingPairs } from "@/config";
import { connectionManager } from "@/websocket/connectionManager";

export function handleHttpRequest(req: Request): Response {
  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname === "/health") {
    const data = {
      status: "ok",
      timestamp: new Date().toISOString(),
      connectedClients: connectionManager.totalConnections,
    };
    return Response.json(data);
  }

  if (req.method === "GET" && url.pathname === "/api/pairs") {
    return Response.json(tradingPairs);
  }

  return new Response("Not Found", { status: 404 });
}
