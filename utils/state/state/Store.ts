import { State } from "./State";

export class Store {
  map = new Map<string, State<any>>();

  use<T>(id: string): State<T | undefined>;
  use<T>(
    id: string,
    fn: (value: T | undefined) => PromiseLike<T> | T
  ): State<T>;
  use<T>(
    id: string,
    fn: ((value: T | undefined) => PromiseLike<T> | T) | undefined
  ): State<T | undefined>;
  use<T>(
    id: string,
    fn?: ((value: T | undefined) => PromiseLike<T> | T) | undefined
  ): State<T | undefined> {
    let state = this.map.get(id) as State<T | undefined>;
    if (state) {
      if (!state.initialized() && fn) {
        state.set(fn, true);
      }
      return state;
    }
    state = new State<T | undefined>(fn, { map: this.map, key: id });
    this.map.set(id, state);
    return state;
  }

  useMany<T>(id: RegExp): [id: string, state: State<T | undefined>][];
  useMany<T>(
    id: RegExp,
    fn: (id: string, value: T | undefined) => Promise<T> | T
  ): [id: string, state: State<T>][];
  useMany<T>(
    id: RegExp,
    fn?: (id: string, value: T | undefined) => Promise<T> | T
  ): [id: string, state: State<T | undefined>][] {
    const matches = [];
    for (let key of this.map.keys()) {
      if (key.match(id)) {
        matches.push(key);
      }
    }
    const results: [id: string, state: State<T | undefined>][] = [];
    for (let match of matches) {
      const state = fn
        ? this.use<T>(match, (value) => fn(match, value))
        : this.use<T>(match);
      results.push([match, state as State<T | undefined>]);
    }
    return results;
  }

  useAsync<T>(
    id: string,
    fn: PromiseLike<((value: T | undefined) => PromiseLike<T> | T) | undefined>
  ): State<T | undefined> {
    let state = this.map.get(id) as State<T | undefined>;
    if (!state) {
      if (!("then" in fn)) {
        // allow conditional sync use
        return this.use(id, fn);
      }
      state = new State<T | undefined>(undefined, { map: this.map, key: id });
      this.map.set(id, state);
      fn.then((fn) => fn && state.set(fn, true));
    } else if (!state.initialized()) {
      fn.then((fn) => fn && state.set(fn, true));
    }
    return state;
  }

  /*
  delete(id: string) {
    let state = this.map.get(id);
    if (!state) return;
    state.().then((deleted) => {
      if (deleted) {
        this.clusters.forEach((cluster) => cluster.removeState(state!));
      }
    });
  }

  clusterSubscribe<T>(id: string, callback: (value: Map<string, T>) => void) {
    let cluster = this.clusters.get(id);
    if (!cluster) {
      cluster = new NotificationCluster();
    }
    return cluster.subscribe(callback);
  }
  */
}
