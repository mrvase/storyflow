import type { DefaultOperation, ServerPackage, WithMetaData } from "./types";

export const createPromise = <T>() => {
  let props: {
    resolve: (value: T | PromiseLike<T>) => void;
    reject: (reason?: any) => void;
  } = {} as any;
  const promise = new Promise((res, rej) => {
    props.resolve = res;
    props.reject = rej;
  }) as Promise<T> & typeof props;
  Object.assign(promise, props);
  return promise;
};

export function filterServerPackages<T extends DefaultOperation>(
  version: number,
  pkgs: ServerPackage<T>[]
) {
  let found = false;
  return pkgs.filter((el) => {
    const index = unwrapServerPackage(el).index;
    if (index === version) {
      found = true;
    }
    return found && index >= version;
  });
}

/*
export function createTimer() {
  let time = Date.now();
  let getDelta = () => Date.now() - time;
  let trigger = () => (time = Date.now());

  return {
    getDelta,
    trigger,
  };
}
*/

const PKG_KEY = 0;
const PKG_CLIENT = 1;
const PKG_INDEX = 2;
const PKG_OPERATIONS = 3;

export function createServerPackage<Operation extends DefaultOperation>(data: {
  key: string;
  clientId: string | number | null;
  index: number;
  operations: Operation[];
}) {
  return Object.values({
    [PKG_KEY]: data.key,
    [PKG_CLIENT]: data.clientId,
    [PKG_INDEX]: data.index,
    [PKG_OPERATIONS]: data.operations,
  }) as ServerPackage<Operation>;
}

export function unwrapServerPackage<Operation extends DefaultOperation>(
  pkg: ServerPackage<Operation>
) {
  return {
    key: pkg[PKG_KEY],
    clientId: pkg[PKG_CLIENT],
    index: pkg[PKG_INDEX],
    operations: pkg[PKG_OPERATIONS],
  };
}

export const unwrapOperations = <Operation extends DefaultOperation>(
  array: ReturnType<typeof unwrapServerPackage<Operation>>[]
): WithMetaData<Operation>[] => {
  const result: WithMetaData<Operation>[] = [];
  array.forEach(({ key, clientId, index, operations }, serverPackageIndex) =>
    operations.forEach((operation, operationIndex) => {
      result.push({
        key,
        clientId,
        index,
        serverPackageIndex,
        operationIndex,
        operation,
      });
    })
  );
  return result;
};
