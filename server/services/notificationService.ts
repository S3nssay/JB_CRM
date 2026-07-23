import type { Response } from 'express';

/**
 * SSE Notification Service
 * Maintains connected CRM clients and pushes real-time events.
 * Used for: inbound call popups, outbound call status, message notifications.
 */

interface SSEClient {
  userId: number;
  response: Response;
  connectedAt: Date;
}

class NotificationService {
  private clients: Map<number, SSEClient> = new Map();

  /**
   * Register a new SSE client connection
   */
  addClient(userId: number, res: Response): void {
    // Close any existing connection for this user
    const existing = this.clients.get(userId);
    if (existing) {
      try { existing.response.end(); } catch { /* ignore */ }
    }

    this.clients.set(userId, {
      userId,
      response: res,
      connectedAt: new Date(),
    });

    console.log(`[SSE] Client connected: user ${userId} (${this.clients.size} total)`);
  }

  /**
   * Remove a client connection
   */
  removeClient(userId: number): void {
    this.clients.delete(userId);
    console.log(`[SSE] Client disconnected: user ${userId} (${this.clients.size} total)`);
  }

  /**
   * Push event to a specific user
   */
  pushToUser(userId: number, event: any): void {
    const client = this.clients.get(userId);
    if (!client) return;
    try {
      client.response.write(`data: ${JSON.stringify(event)}\n\n`);
    } catch {
      this.clients.delete(userId);
    }
  }

  /**
   * Push event to ALL connected clients (e.g. inbound call notification)
   */
  pushToAll(event: any): void {
    const data = `data: ${JSON.stringify(event)}\n\n`;
    for (const [userId, client] of this.clients.entries()) {
      try {
        client.response.write(data);
      } catch {
        this.clients.delete(userId);
      }
    }
  }

  /**
   * Push event to all clients in a specific department
   */
  pushToDepartment(department: string, event: any): void {
    // For now, push to all - can be refined with user department lookup
    this.pushToAll(event);
  }

  /**
   * Get count of connected clients
   */
  getClientCount(): number {
    return this.clients.size;
  }
}

export const notificationService = new NotificationService();

// Heartbeat every 30s to keep SSE connections alive
setInterval(() => {
  for (const [userId, client] of (notificationService as any).clients.entries()) {
    try {
      client.response.write(':\n\n');
    } catch {
      (notificationService as any).clients.delete(userId);
    }
  }
}, 30_000);
