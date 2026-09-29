/** Minimal typed event emitter (avoids depending on Node's EventEmitter in shared code). */
export class TypedEmitter<Events extends Record<string, unknown>> {
  private listeners = new Map<keyof Events, Set<(payload: never) => void>>();

  on<K extends keyof Events>(event: K, listener: (payload: Events[K]) => void): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(listener as (payload: never) => void);
    return () => set.delete(listener as (payload: never) => void);
  }

  protected emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    this.listeners.get(event)?.forEach((listener) => {
      try {
        (listener as (p: Events[K]) => void)(payload);
      } catch (error) {
        // A misbehaving listener must never break the emitter's owner.
        console.error('[emitter] listener threw', error);
      }
    });
  }
}
