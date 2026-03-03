/**
 * In-process event bus for broadcasting webhook-received events to SSE clients.
 *
 * When POST /api/hooks receives a webhook from the plugin, it emits the event
 * onto this bus. The SSE endpoint (GET /api/events) subscribes each connected
 * browser client as a listener and forwards every event as an SSE frame.
 */

export type SSEClient = (eventType: string, data: string) => void;

export class EventBus {
  private clients = new Set<SSEClient>();

  /** Register an SSE client. Returns an unsubscribe function. */
  subscribe(client: SSEClient): () => void {
    this.clients.add(client);
    return () => {
      this.clients.delete(client);
    };
  }

  /** Broadcast an event to all connected SSE clients. */
  emit(eventType: string, data: Record<string, unknown>): void {
    const payload = JSON.stringify(data);
    for (const client of this.clients) {
      try {
        client(eventType, payload);
      } catch {
        // Client write failed — will be cleaned up on disconnect
        this.clients.delete(client);
      }
    }
  }

  /** Number of connected clients (useful for health/debug). */
  get clientCount(): number {
    return this.clients.size;
  }
}

/** Singleton event bus shared across the server process. */
export const eventBus = new EventBus();
