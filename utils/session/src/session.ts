export interface SessionData {
  [name: string]: any;
}

export interface Session {
  readonly data: SessionData;
  has(name: string): boolean;
  get(name: string): any;
  set(name: string, value: any): void;
  unset(name: string): void;
}

export const createSession = (initialData: SessionData = {}): Session => {
  let map = new Map<string, any>(Object.entries(initialData));

  return {
    get data() {
      return Object.fromEntries(map);
    },
    has(name) {
      return map.has(name);
    },
    get(name) {
      if (map.has(name)) return map.get(name);
      return undefined;
    },
    set(name, value) {
      map.set(name, value);
    },
    unset(name) {
      map.delete(name);
    },
  };
};

export const isSession = (object: any): object is Session => {
  return (
    object != null &&
    typeof object.data !== "undefined" &&
    typeof object.has === "function" &&
    typeof object.get === "function" &&
    typeof object.set === "function" &&
    typeof object.unset === "function"
  );
};
