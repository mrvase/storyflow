import { isError, Result, unwrap } from "@storyflow/result";
import { createChangeDebugger } from "./debug";
import { Queue } from "./Queue";
import { DefaultOperation, ServerPackage, ServerPackageArray } from "./types";
import { createPromise, unwrapServerPackage } from "./utils";

export interface QueueMap<
  Operation extends DefaultOperation,
  Q extends Queue<Operation>
> {
  get: <GetOperation extends Operation = Operation>(
    document: string,
    key: string
  ) => (Q & Queue<GetOperation>) | undefined;
  set: <SetOperation extends Operation = Operation>(
    document: string,
    key: string,
    queue: Queue<SetOperation>
  ) => void;
  delete: (document: string, key: string) => void;
  syncEach: (
    callback: (
      pkg: ServerPackage<Operation>,
      ctx: {
        key: string;
        document: string;
      }
    ) => Promise<false | ServerPackageArray<Operation>>,
    options?: {
      force?: boolean;
    }
  ) => void;
  purge: () => void;
}

export function createQueueMap<
  Operation extends DefaultOperation,
  Q extends Queue<Operation>
>(): QueueMap<Operation, Q> {
  const debug = createChangeDebugger();

  const queues = new Map<string, Q>();

  const getId = (document: string, key: string) => `${document}:${key}`;
  const splitId = (id: string) => ({
    document: id.split(":")[0],
    key: id.split(":")[1],
  });

  return {
    get: (document: string, key: string) => {
      const queue = queues.get(getId(document, key));
      debug("QUEUE MAP", ...queues.keys());
      return queue as any;
    },
    set: (document, key, queue) => {
      queues.set(getId(document, key), queue as any);
      debug("QUEUE MAP", ...queues.keys());
    },
    delete: (document, key) => {
      queues.delete(getId(document, key));
      debug("QUEUE MAP", ...queues.keys());
    },
    syncEach: (callback, options) => {
      queues.forEach((queue, key) =>
        queue.sync((pkg) => callback(pkg, splitId(key)), options)
      );
      debug("QUEUE MAP", ...queues.keys());
    },
    purge: () => {
      Array.from(queues.entries()).forEach(([id, queue]) => {
        if (queue.isInactive()) {
          queues.delete(id);
        }
      });
      debug("QUEUE MAP", ...queues.keys());
    },
  };
}

export async function syncQueueMap<Operation extends DefaultOperation>(
  queues: QueueMap<Operation, Queue<Operation>>,
  mutation: (
    input: Record<string, Record<string, ServerPackage<Operation>>>
  ) => Promise<
    Result<Record<string, Record<string, ServerPackageArray<Operation>>>>
  >,
  options: {
    force?: boolean;
  } = {}
) {
  const promises: {
    document: string;
    promise: ReturnType<
      typeof createPromise<ServerPackageArray<Operation> | false>
    >;
    pkg: ServerPackage<Operation>;
  }[] = [];

  const callback = (
    pkg: ServerPackage<Operation>,
    ctx: { document: string }
  ) => {
    const promise = createPromise<ServerPackageArray<Operation> | false>();
    promises.push({
      document: ctx.document,
      promise,
      pkg,
    });
    return promise;
  };

  queues.syncEach(callback, options);

  const input = promises.reduce((acc, cur) => {
    if (!acc[cur.document]) {
      acc[cur.document] = {};
    }
    const unwrapped = unwrapServerPackage(cur.pkg);
    if (unwrapped.operations.length) {
      acc[cur.document][unwrapped.key] = cur.pkg;
    }
    return acc;
  }, {} as Record<string, Record<string, ServerPackage<Operation>>>);

  const result = await mutation(input);

  promises.forEach(({ pkg, document, promise }) => {
    if (isError(result)) {
      promise.resolve(false);
    } else {
      const doc = unwrap(result)[document];
      const pkgs = doc[unwrapServerPackage(pkg).key];
      promise.resolve(pkgs ?? doc["VERSION"]);
    }
  });

  return result;
}
