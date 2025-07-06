// src/websocket/utils.ts
import type { ClientWebSocket, ServerMessage } from "@/types";

export function sendMessage(ws: ClientWebSocket, message: ServerMessage) {
  try {
    ws.send(
      JSON.stringify({
        ...message,
        // Add a server-side timestamp to every message
        timestamp: new Date().toISOString(),
      })
    );
  } catch (error) {
    console.error(`Failed to send message to ${ws.id}:`, error);
  }
}

export function sendError(ws: ClientWebSocket, type: string, message: string) {
  sendMessage(ws, {
    event: "error",
    payload: { type, message },
  });
}
