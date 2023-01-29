// export type OperationArray<A> = A extends any ? A[] : never;

export type DefaultOperation = object;

export type ServerPackage<Operation extends DefaultOperation> = [
  key: string,
  clientId: string | number | null,
  index: number,
  operations: Operation[]
];

export type WithMetaData<Operation extends DefaultOperation> = {
  key: string;
  clientId: string | number | null;
  index: number;
  serverPackageIndex: number | null;
  operationIndex: number | null;
  operation: Operation;
};
