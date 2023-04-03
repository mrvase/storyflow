import React from "react";

export type Reducers<State> = {
  [key: string]: (state: State, action?: any) => State;
};

export type Actions<R extends Reducers<any>> = {
  [Key in keyof R]: Parameters<R[Key]>[1] extends undefined
    ? () => ReturnType<R[Key]>
    : (action: Parameters<R[Key]>[1]) => ReturnType<R[Key]>;
};

function match(reducers: Reducers<any>) {
  return (state: any, action: { type: string; payload: any }) => {
    const reducer = reducers[action.type];
    if (reducer) {
      return reducer(state, action.payload);
    }
    return state;
  };
}

export function useReducer<State, T extends Reducers<State>>(
  reducers: T,
  initialState: State
) {
  const [state, setState] = React.useState(initialState);

  const proxy = React.useMemo(() => {
    const proxy: Actions<T> = {} as any;
    Object.keys(reducers).forEach((key) => {
      proxy[key as keyof typeof proxy] = ((payload: any) => {
        setState((ps) => reducers[key](ps, payload));
      }) as any;
    });
    return proxy;
  }, [reducers]);

  return [state, proxy] as [State, typeof proxy];
}

export function useReducerWithReturnValue<State, T extends Reducers<State>>(
  reducers: T,
  initialState: State
) {
  const [state, setState] = React.useState(initialState);

  const proxy = React.useMemo(() => {
    const proxy: Actions<T> = {} as any;
    Object.keys(reducers).forEach((key) => {
      proxy[key as keyof typeof proxy] = ((payload: any) => {
        setState((ps) => reducers[key](ps, payload));
        return reducers[key](state, payload);
      }) as any;
    });
    return proxy;
  }, [reducers, state]);

  return [state, proxy] as [State, typeof proxy];
}
