/**
 * Achievements.
 * There are only updates at read.
 * There are often only reads from notifications.
 * So with manual batching, any unnecessary execution is delayed until notifications run at the end.
 * At the same time, if an updated value is needed in the batch, the read triggers the necessary update chain
 * without triggering non-node subscribers.
 */

let CurrentReaction: State<any> | undefined = undefined;
let CurrentGets: State<any>[] | null = null;
let CurrentGetsIndex = 0;
let NotificationQueue: (() => void)[] = [];
let BatchedNotificationQueue: (() => void)[] = [];
let ManualQueueCall = 0;

export function batch<T>(callback: () => T): T {
  ManualQueueCall++;
  const result = callback();
  ManualQueueCall--;
  executeNotificationQueue(); // only executed if !ManualQueueCall
  return result;
}

export const CacheClean = 0;
export const CacheCheck = 1;
export const CacheDirty = 2;

export type CacheState =
  | typeof CacheClean
  | typeof CacheCheck
  | typeof CacheDirty;

type CacheNonClean = typeof CacheCheck | typeof CacheDirty;

type SyncArgs<T> = [(callback: () => void) => () => void, () => T];

function captureContext(element: State<any>, callback: () => void) {
  const prevReaction = CurrentReaction;
  const prevGets = CurrentGets;
  const prevIndex = CurrentGetsIndex;

  CurrentReaction = element;
  CurrentGets = null as any; // prevent TS from thinking CurrentGets is null below
  CurrentGetsIndex = 0;

  try {
    callback();
  } finally {
    CurrentGets = prevGets;
    CurrentReaction = prevReaction;
    CurrentGetsIndex = prevIndex;
  }
}

export class State<T> {
  private fn?: (value: T | undefined) => T | PromiseLike<T>;
  private _value: T;
  private observers: State<any>[] | null = null; // nodes that have us as sources (down links)
  private sources: State<any>[] | null = null; // sources in reference order, not deduplicated (up links)

  private store:
    | {
        map: Map<string, State<any>>;
        key: string;
      }
    | undefined;

  private state: CacheState;

  initialized() {
    return typeof this.fn !== "undefined";
  }

  constructor(
    fn?: (value: T | undefined) => PromiseLike<T> | T,
    store?: { map: Map<string, State<any>>; key: string }
  ) {
    this.fn = fn;
    if (this.fn) {
      this.state = CacheDirty;
    } else {
      this.state = CacheClean;
    }
    this._value = undefined as any;
    this.store = store;
  }

  get value(): T {
    return this.get();
  }

  peek(): T {
    this.updateIfNecessary();
    return this._value;
  }

  get(): T {
    if (CurrentReaction) {
      if (
        !CurrentGets &&
        CurrentReaction.sources &&
        CurrentReaction.sources[CurrentGetsIndex] == this
      ) {
        CurrentGetsIndex++;
      } else {
        if (!CurrentGets) CurrentGets = [this];
        else CurrentGets.push(this);
      }
    }
    return this.peek();
  }

  set(fn: (value: T | undefined) => T | PromiseLike<T>, delay?: boolean): void {
    this.fn = fn;
    NotificationQueue.push(() => this.notify());
    this.state = CacheDirty;
    if (this.observers) {
      for (let i = 0; i < this.observers.length; i++) {
        this.observers[i].stale(CacheCheck);
        // changed from dirty to check to make the value diff
        // in update() a condition for making children dirty.
        // Due to the order of the notification queue, they will be made
        // dirty by the parent before they are requested.
      }
    }
    executeNotificationQueue(delay); // only executed if !ManualQueueCall
  }

  private asyncTimestamp: number | null = null;

  private then(value: T, timestamp: number) {
    if (timestamp !== this.asyncTimestamp) {
      return;
    }
    NotificationQueue.push(() => this.notify());
    const oldValue = this._value;
    this._value = value;
    // this is merging set and update
    // we do not want to run the function again, so we do not call update
    // but we do want to change the value and let observers and subscribers
    // know, so we mark observers as dirty and execute notification queue
    // (which also calculates observers)
    if (oldValue !== this._value) {
      this.updateVersion++;
      if (this.observers) {
        for (let i = 0; i < this.observers.length; i++) {
          this.observers[i].stale(CacheDirty);
        }
      }
    }
    executeNotificationQueue();
  }

  private stale(state: CacheNonClean): void {
    if (this.state === CacheClean) {
      NotificationQueue.push(() => this.notify());
    }
    if (this.state < state) {
      this.state = state;
      if (this.observers) {
        for (let i = 0; i < this.observers.length; i++) {
          this.observers[i].stale(CacheCheck);
        }
      }
    }
  }

  private handleSources(): void {
    if (CurrentGets) {
      this.removeAsObserver();

      if (this.sources && CurrentGetsIndex > 0) {
        this.sources.length = CurrentGetsIndex + CurrentGets.length;
        for (let i = 0; i < CurrentGets.length; i++) {
          this.sources[CurrentGetsIndex + i] = CurrentGets[i];
        }
      } else {
        this.sources = CurrentGets;
      }

      for (let i = CurrentGetsIndex; i < this.sources.length; i++) {
        const source = this.sources[i];
        if (!source.observers) {
          source.observers = [this];
        } else {
          source.observers.push(this);
        }
      }
    } else if (this.sources && CurrentGetsIndex < this.sources.length) {
      this.removeAsObserver();

      this.sources.length = CurrentGetsIndex;
    } else {
      // the same sources
    }
  }

  private update(): void {
    if (!this.initialized()) {
      throw new Error("Not initialized");
    }

    const oldValue = this._value;

    captureContext(this, () => {
      const result = this.fn!(oldValue);
      if (typeof result === "object" && result !== null && "then" in result) {
        const timestamp = Date.now();
        this.asyncTimestamp = timestamp;
        result.then((res) => this.then(res, timestamp));
      } else {
        this._value = result;
      }
      this.handleSources();
    });

    if (oldValue !== this._value) {
      this.updateVersion++;
      if (this.observers) {
        for (let i = 0; i < this.observers.length; i++) {
          this.observers[i].state = CacheDirty;
        }
      }
    }

    this.state = CacheClean;
  }

  private updateIfNecessary(): void {
    if (this.state === CacheCheck) {
      for (const source of this.sources!) {
        source.updateIfNecessary(); // updateIfNecessary() can change this.state
        if ((this.state as CacheState) === CacheDirty) {
          // Stop the loop here so we won't trigger updates on other parents unnecessarily
          // If our computation changes to no longer use some sources, we don't
          // want to update() a source we used last time, but now don't use.
          break;
        }
      }
    }

    // If we were already dirty or marked dirty by the step above, update.
    if (this.state === CacheDirty) {
      this.update();
    }

    // By now, we're clean
    this.state = CacheClean;
  }

  private removeAsObserver(): void {
    // removeParentObservers
    if (!this.sources) return;
    for (let i = CurrentGetsIndex; i < this.sources!.length; i++) {
      const source: State<any> = this.sources![i]; // We don't actually delete sources here because we're replacing the entire array soon
      const swap = source.observers!.findIndex((v) => v === this);
      source.observers![swap] = source.observers![source.observers!.length - 1];
      source.observers!.pop();
      source.possiblyDeleteFromStore();
    }
  }

  private deleteFromStore() {
    if (!this.store) return false;
    this.removeAsObserver();
    this.store.map.delete(this.store.key);
    return true;
  }

  private possiblyDeleteFromStore() {
    return new Promise<boolean>((resolve) => {
      queueMicrotask(() => {
        // it is called when an observer is removed, but queueing it allows observer to be immediately re-added.
        // it also allows useEffects to rerun without deleting the state
        const hasSubscribers = this.subscribers.size > 0;
        const hasObservers = this.observers && this.observers.length > 0;
        if (hasSubscribers || hasObservers) return resolve(false);
        return resolve(this.deleteFromStore());
      });
    });
  }

  private subscribers = new Set<(state: T | undefined) => void>();

  subscribe(subscriber: (state: T | undefined) => void) {
    this.subscribers.add(subscriber);
    subscriber(this.value);
    return () => {
      this.subscribers.delete(subscriber);
      this.possiblyDeleteFromStore();
    };
  }

  private notifyVersion: number = 0;
  private updateVersion: number = 0;

  private notify() {
    // the reading of the value here is what triggers the updates
    const value = this.peek();
    if (this.notifyVersion !== this.updateVersion) {
      // this ensures deduplication + no update => no notification
      this.subscribers.forEach((subscriber) => subscriber(value));
      this.notifyVersion === this.updateVersion;
    }
  }

  sync: SyncArgs<T | undefined> = [
    (callback) => this.subscribe(callback),
    () => this.peek(),
  ];
}

export function executeNotificationQueue(delay?: boolean) {
  if (!ManualQueueCall) {
    let queue = Array.from(NotificationQueue);
    NotificationQueue.length = 0;
    const delayer = delay ? queueMicrotask : (callback: any) => callback();
    delayer(() => {
      // to avoid propagating changed state at render
      for (let i = 0; i < queue.length; i++) {
        queue[i]();
      }
      queue.length = 0;
      /*
      for (let i = 0; i < BatchedNotificationQueue.length; i++) {
        BatchedNotificationQueue[i]();
      }
      BatchedNotificationQueue.length = 0;
      */
    });
  }
}

/*
export class NotificationCluster {
  unsubscribers = new WeakMap<State<any>, () => void>();
  batchedNotifications = new Map<string, any>();

  batchNotify() {
    const batch = new Map(this.batchedNotifications);
    this.batchedNotifications.clear();
    this.batchSubscribers.forEach((subscriber) => subscriber(batch));
  }

  addState(key: string, value: State<any>) {
    const subscriber = (state: any) => {
      if (this.batchedNotifications.size === 0) {
        BatchedNotificationQueue.push(() => this.batchNotify());
      }
      this.batchedNotifications.set(key, state);
    };
    this.unsubscribers.set(value, value.subscribe(subscriber));
  }

  removeState(state: State<any>) {
    const unsubscriber = this.unsubscribers.get(state);
    if (unsubscriber) {
      unsubscriber();
      this.unsubscribers.delete(state);
    }
  }

  batchSubscribers = new Set<(states: Map<string, any>) => void>();

  subscribe(subscriber: (states: Map<string, any>) => void) {
    this.batchSubscribers.add(subscriber);
    return () => {
      this.batchSubscribers.delete(subscriber);
    };
  }
}
*/
