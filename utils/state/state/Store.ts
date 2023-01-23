import { State } from "./State";

export class Store {
  map = new Map<string, State<any>>();
  // clusters = new Map<string, NotificationCluster>();

  use<T>(id: string): State<T | undefined>;
  use<T>(
    id: string,
    fn: (value: T | undefined) => Promise<T> | T,
    options?: { cluster?: string }
  ): State<T>;
  use<T>(
    id: string,
    fn?: (value: T | undefined) => Promise<T> | T,
    options: { cluster?: string } = {}
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
    /*
    if (options.cluster) {
      let cluster = this.clusters.get(options.cluster);
      if (!cluster) {
        cluster = new NotificationCluster();
      }
      cluster.addState(id, state);
    }
    */
    return state;
  }

  useAsync<T>(
    id: string,
    fn: Promise<((value: T | undefined) => Promise<T> | T) | undefined>
  ): State<T | undefined> {
    let state = this.map.get(id) as State<T | undefined>;
    if (!state) {
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
