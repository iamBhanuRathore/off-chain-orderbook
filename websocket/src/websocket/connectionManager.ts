// src/websocket/connectionManager.ts
import type { ClientWebSocket } from "@/types";
import { randomUUID } from "crypto";

class ConnectionManager {
  private websockets = new Map<string, ClientWebSocket>();
  private userSubscriptions = new Map<string, Set<string>>(); // wsId -> Set<channel>
  private channelSubscribers = new Map<string, Set<string>>(); // channel -> Set<wsId>

  public get totalConnections(): number {
    return this.websockets.size;
  }

  add(ws: ClientWebSocket) {
    const wsId = randomUUID();
    ws.id = wsId; // Attach ID to the WebSocket object
    this.websockets.set(wsId, ws);
    this.userSubscriptions.set(wsId, new Set());
    console.log(`Client connected: ${wsId}`);
  }

  remove(wsId: string) {
    const userSubs = this.userSubscriptions.get(wsId);
    if (userSubs) {
      userSubs.forEach((channel) => {
        const subscribers = this.channelSubscribers.get(channel);
        if (subscribers) {
          subscribers.delete(wsId);
          if (subscribers.size === 0) {
            this.channelSubscribers.delete(channel);
          }
        }
      });
    }
    this.userSubscriptions.delete(wsId);
    this.websockets.delete(wsId);
    console.log(`Client disconnected: ${wsId}`);
  }

  subscribe(wsId: string, channel: string) {
    this.userSubscriptions.get(wsId)?.add(channel);
    if (!this.channelSubscribers.has(channel)) {
      this.channelSubscribers.set(channel, new Set());
    }
    this.channelSubscribers.get(channel)?.add(wsId);
  }

  unsubscribe(wsId: string, channel: string) {
    this.userSubscriptions.get(wsId)?.delete(channel);
    this.channelSubscribers.get(channel)?.delete(wsId);
  }

  broadcastToChannel(channel: string, message: object) {
    const subscribers = this.channelSubscribers.get(channel);
    if (subscribers) {
      const stringifiedMessage = JSON.stringify(message);
      subscribers.forEach((wsId) => {
        const ws = this.websockets.get(wsId);
        // Check if the connection is still open
        if (ws && ws.readyState === 1) {
          ws.send(stringifiedMessage);
        }
      });
    }
  }
}

export const connectionManager = new ConnectionManager();
