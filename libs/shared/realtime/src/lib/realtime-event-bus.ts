import { RealtimeEventType, type RealtimeEvent } from './types.js';

export type RealtimeEventHandler<T = any> = (event: RealtimeEvent<T>) => void;

/**
 * In-memory typed event bus for client-side realtime events.
 *
 * Provides deduplication to ignore replayed or multi-tab duplicated events,
 * and isolates subscriber failures so an error in one component handler
 * never impacts other subscribers.
 */
export class RealtimeEventBus {
  private readonly listeners = new Map<string, Set<RealtimeEventHandler>>();
  private readonly anyListeners = new Set<RealtimeEventHandler>();
  private readonly processedIds = new Set<string>();
  private readonly processedIdOrder: string[] = [];
  private readonly maxTrackedIds = 500;

  /**
   * Subscribes to a specific real-time event type.
   * Returns an unsubscribe function.
   */
  on<T = any>(
    type: RealtimeEventType | string,
    handler: RealtimeEventHandler<T>,
  ): () => void {
    let set = this.listeners.get(type);
    if (!set) {
      set = new Set();
      this.listeners.set(type, set);
    }
    set.add(handler as RealtimeEventHandler);

    return () => {
      set?.delete(handler as RealtimeEventHandler);
      if (set && set.size === 0) {
        this.listeners.delete(type);
      }
    };
  }

  /**
   * Subscribes to all real-time events.
   */
  onAny(handler: RealtimeEventHandler): () => void {
    this.anyListeners.add(handler);
    return () => {
      this.anyListeners.delete(handler);
    };
  }

  /**
   * Dispatches an event to matching subscribers.
   * Automatically deduplicates events by ID.
   */
  emit<T = any>(event: RealtimeEvent<T>): boolean {
    if (!event || !event.type) return false;

    // Deduplication check
    if (event.id) {
      if (this.processedIds.has(event.id)) {
        return false;
      }
      this.processedIds.add(event.id);
      this.processedIdOrder.push(event.id);

      if (this.processedIdOrder.length > this.maxTrackedIds) {
        const oldest = this.processedIdOrder.shift();
        if (oldest) this.processedIds.delete(oldest);
      }
    }

    const typeSet = this.listeners.get(event.type);
    if (typeSet) {
      for (const handler of typeSet) {
        try {
          handler(event);
        } catch (err) {
          console.error(`[RealtimeEventBus] Handler failed for ${event.type}:`, err);
        }
      }
    }

    for (const handler of this.anyListeners) {
      try {
        handler(event);
      } catch (err) {
        console.error(`[RealtimeEventBus] onAny handler failed for ${event.type}:`, err);
      }
    }

    return true;
  }

  /**
   * Clears all subscribers and deduplication history.
   */
  clear(): void {
    this.listeners.clear();
    this.anyListeners.clear();
    this.processedIds.clear();
    this.processedIdOrder.length = 0;
  }
}
