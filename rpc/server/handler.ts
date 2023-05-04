import qs from "qs";
import { error, isError, success } from "@storyflow/result";
import type { API, MutationObject, QueryObject } from "@sfrpc/types";
import type { DefaultRequest, DefaultResponse } from "./types";

const isPrimitive = (obj: any) => {
  return (
    obj === null ||
    ["string", "boolean", "number", "undefined", "symbol"].includes(typeof obj)
  );
};

const modifyJSONPrimitives = (
  obj: object,
  callback: (value: any) => any
): any => {
  if (isPrimitive(obj)) {
    return callback(obj);
  }
  if (Array.isArray(obj)) {
    return obj.map((el) => modifyJSONPrimitives(el, callback));
  } else {
    let newObject: Record<string | number | symbol, any> = {};
    Object.entries(obj).forEach(([key, value]) => {
      newObject[key] = modifyJSONPrimitives(value, callback);
    });
    return newObject;
  }
};

const handleTypes = (object: object) => {
  return modifyJSONPrimitives(object, (value) => {
    if (value === "true") {
      return true;
    }
    if (value === "false") {
      return false;
    }
    let int = parseInt(value, 10);
    if (value === String(int)) {
      return int;
    }
    return value;
  });
};

const getInputFromUrl = (url: string | undefined) => {
  const query = (url ?? "").split("?")[1] ?? "";
  const parsedQuery = qs.parse(query);
  return parsedQuery as { query: any; ctx: any };
};

const getInput = (req: any) => {
  if (req.method === "GET") {
    return handleTypes(getInputFromUrl(req.url));
  }
  if (req.method === "POST") {
    return {
      ctx: handleTypes(getInputFromUrl(req.url))?.ctx ?? {},
      query: req.body?.query ?? {},
    };
  }
  return undefined;
};

export function createHandler<
  T extends API,
  Req extends DefaultRequest,
  Res extends DefaultResponse
>(router: T, _route?: string, _procedure?: string) {
  return async function (req: Req, res: Res) {
    const { route, procedure } = {
      ...(req.params ?? req.query), // express vs vercel
      ...(_route && { route: _route }),
      ...(_procedure && { procedure: _procedure }),
    };

    const id = Math.random().toString(36).substring(2, 6);

    console.log("REQUEST", `${route}/${procedure}`, req.method);
    console.time(`REQUEST TIME ${route}/${procedure} ${id}`);

    if (
      !route ||
      !procedure ||
      typeof route !== "string" ||
      typeof procedure !== "string"
    ) {
      console.timeEnd(`REQUEST TIME ${route}/${procedure} ${id}`);
      console.log("\n\n");
      res.status(404).json(error({ message: "API route not found." }));
      return;
    }

    const action =
      req.method === "GET"
        ? "query"
        : req.method === "POST"
        ? "mutation"
        : undefined;

    const input = getInput(req);
    const context = {
      req,
      res,
      client: input?.ctx ?? {},
    };
    const obj = router[route]?.[procedure] as QueryObject;
    let func = obj?.[action as "query"];

    if (!obj || (action && !func)) {
      res.status(404).json(
        error({
          message: `API route not found: ${route} ${procedure} ${action}`,
        })
      );
      console.timeEnd(`REQUEST TIME ${route}/${procedure} ${id}`);
      console.log("\n\n");
      return;
    }

    try {
      if (!func) {
        func = "query" in obj ? obj.query : (obj as MutationObject).mutation;
      }

      const result = await func.call(
        { context, method: req.method },
        input?.query
      );

      console.timeEnd(`REQUEST TIME ${route}/${procedure} ${id}`);
      console.log("\n\n");

      if (res.writableEnded) {
        return;
      }

      if (req.method === "OPTIONS") {
        console.log("\n\n");
        return res.status(200).end();
      }

      if (!result) {
        return res.status(200).json(success(null));
      }

      if (isError(result)) {
        return res.status(result.status ?? 500).json(result);
      }

      return res.status(200).json(result);
    } catch (err) {
      console.timeEnd(`REQUEST TIME ${route}/${procedure} ${id}`);
      console.log("\n\n");

      console.log("ERROR");
      res.status(500).json(error({ message: "serverfejl", detail: err }));
    }
  };
}
