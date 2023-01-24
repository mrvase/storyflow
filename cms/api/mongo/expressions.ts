let count = 0;

type Input = string | Record<string, any>;

let getRef = () => `r${count++}`;

export const $map = (
  input: Input | Array<any>,
  callback: (ref: string) => Input
) => {
  const ref = getRef();
  return {
    $map: {
      input,
      as: ref,
      in: callback(`$$${ref}`),
    },
  };
};

export function $reduce(
  input: Input | Array<any>,
  callback: (accumulator: string, current: string) => any,
  initialValue: any
) {
  const accumulator = getRef();
  const current = getRef();
  return {
    $reduce: {
      input,
      initialValue,
      in: $let({
        [accumulator]: "$$value",
        [current]: "$$this",
      }).return(() => callback(`$$${accumulator}`, `$$${current}`)),
    },
  };
}

export function $reverseArray(input: any) {
  return {
    $reverseArray: input,
  };
}

export const $filter = (
  input: Input | Array<any>,
  callback: (ref: string) => Record<string, any>
) => {
  const ref = getRef();
  return {
    $filter: {
      input,
      as: ref,
      cond: callback(`$$${ref}`),
    },
  };
};

export const $find = (
  input: Input | Array<any>,
  callback: (ref: string) => Record<string, any>
) => {
  return $first($filter(input, callback));
};

type ToRefs<U extends { [key: string]: any }> = {
  [Key in `$$${keyof U extends string ? keyof U : never}`]: Key;
};

const toRefs = <U extends { [key: string]: any }>(vars: U): ToRefs<U> => {
  return Object.fromEntries(
    Object.keys(vars).map((el) => [`$$${el}`, `$$${el}`])
  ) as ToRefs<U>;
};

export const $let = <I extends { [key: string]: any }>(
  callback: I | ((refs: {}) => I)
) => {
  const lets: Array<{ [key: string]: any }> = [];

  const createObj = <U extends { [key: string]: any }>(initial: U) => ({
    let: <P extends { [key: string]: any }>(
      callback: P | ((refs: ToRefs<U>) => P)
    ) => {
      const added =
        typeof callback === "function" ? callback(toRefs(initial)) : callback;
      lets.push(added);
      return createObj({ ...initial, ...added } as U & P);
    },
    return: (callback: (refs: ToRefs<U>) => any) => {
      return [callback(toRefs(initial)), ...lets.reverse()].reduce(
        (acc, cur) => ({
          $let: {
            vars: cur,
            in: acc,
          },
        })
      );
    },
  });

  return createObj({}).let(callback);
};

export const $define = () => {
  const lets: Array<{ [key: string]: any }> = [];

  const createObj = <U extends { [key: string]: any }>(initial: U) => ({
    $let: <P extends { [key: string]: any }>(
      callback: P | ((refs: ToRefs<U>) => P)
    ) => {
      const added =
        typeof callback === "function" ? callback(toRefs(initial)) : callback;
      lets.push(added);
      return createObj({ ...initial, ...added } as U & P);
    },
    $return: (callback: (refs: ToRefs<U>) => any) => {
      return [callback(toRefs(initial)), ...lets.reverse()].reduce(
        (acc, cur) => ({
          $let: {
            vars: cur,
            in: acc,
          },
        })
      );
    },
  });

  return createObj({});
};

export const $cond = (
  cond: Record<string, any> | string,
  THEN: any,
  ELSE: any
) => {
  return {
    $cond: {
      if: cond,
      then: THEN,
      else: ELSE,
    },
  };
};

export const $and = (...args: any[]) => {
  return {
    $and: args,
  };
};

export const $or = (...args: any[]) => {
  return {
    $or: args,
  };
};
export const $type = (val: any) => {
  return {
    $type: val,
  };
};

export const $first = (input: Input) => {
  return { $first: input };
};

export const $last = (input: Input) => {
  return { $last: input };
};

export const $mergeObjects = (...objects: Input[]) => {
  return {
    $mergeObjects: objects,
  };
};

export const $concat = (input: any) => {
  return {
    $concat: input,
  };
};

export const $concatArrays = (...arrays: Input[]) => {
  return {
    $concatArrays: arrays,
  };
};

export const $not = (arg1: any) => {
  return {
    $not: arg1,
  };
};

export const $in = (arg1: any, arg2: any) => {
  return {
    $in: [arg1, arg2],
  };
};

export const $eq = (arg1: any, arg2: any) => {
  return {
    $eq: [arg1, arg2],
  };
};

export const $ne = (arg1: any, arg2: any) => {
  return {
    $ne: [arg1, arg2],
  };
};

export const $gt = (arg1: any, arg2: any) => {
  return {
    $gt: [arg1, arg2],
  };
};

export const $sizeEq = (arg1: any, arg2: any) => {
  return $eq({ $size: arg1 }, arg2);
};

export const $sizeGt = (arg1: any, arg2: any) => {
  return { $gt: [{ $size: arg1 }, arg2] };
};

export const $sizeLt = (arg1: any, arg2: any) => {
  return { $gt: [{ $size: arg1 }, arg2] };
};

export const $getField = (input: any, field: any) => {
  return { $getField: { input, field } };
};

export const $getAt = (input: any, index: any) => {
  return { $arrayElemAt: [input, index] };
};

export function $safeNumber(input: any, fallback: number = 0) {
  return { $max: [input, fallback] };
}

export function $safeString(input: any, fallback: string = "") {
  return {
    $cond: {
      if: { $eq: [{ $type: input }, "string"] },
      then: input,
      else: fallback,
    },
  };
}

export function $safeArray(input: any) {
  return {
    $cond: {
      if: { $eq: [{ $type: input }, "array"] },
      then: input,
      else: { $literal: [] },
    },
  };
}

export function $literal(input: any) {
  return {
    $literal: input,
  };
}

export function $ifNull(...args: any[]) {
  return {
    $ifNull: args,
  };
}
