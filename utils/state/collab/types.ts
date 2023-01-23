// export type OperationArray<A> = A extends any ? A[] : never;

export type VersionPackage = ["VERSION", number];

export type DefaultOperation = object;

export type ServerPackage<Operation extends DefaultOperation> = [
  key: string,
  version: number | null,
  clientId: string | number | null,
  index: number,
  operations: Operation[]
];

export type ServerPackageArray<Operation extends DefaultOperation> =
  | [VersionPackage | ServerPackage<Operation>, ...ServerPackage<Operation>[]]
  | [];

export type WithMetaData<Operation extends DefaultOperation> = {
  key: string;
  clientId: string | number | null;
  index: number;
  serverPackageIndex: number | null;
  operationIndex: number | null;
  operation: Operation;
};
