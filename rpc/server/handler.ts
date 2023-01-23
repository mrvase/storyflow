import qs from "qs";
import { error, isError, success } from "@storyflow/result";
import { API, QueryObject } from "@sfrpc/types";
import { DefaultRequest, DefaultResponse } from "./types";

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
  return parsedQuery as { query: any; context: any };
};

const getInput = (req: any) => {
  if (req.method === "GET") {
    return handleTypes(getInputFromUrl(req.url));
  }
  if (req.method === "POST") {
    return req.body ?? {};
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

    console.time(`REQUEST TIME ${route}/${procedure}`);

    if (
      !route ||
      !procedure ||
      typeof route !== "string" ||
      typeof procedure !== "string"
    ) {
      console.timeEnd(`REQUEST TIME ${route}/${procedure}`);
      console.log("\n\n");
      res.status(404).json(error({ message: "API route not found." }));
      return;
    }

    const action = req.method === "GET" ? "query" : "mutation";
    const input = getInput(req);
    console.log("INPUT", req.url);
    const context = {
      req,
      res,
      client: input?.context ?? {},
    };
    const func = (router[route]?.[procedure] as QueryObject)?.[
      action as "query"
    ];
    if (!func) {
      res.status(404).json(
        error({
          message: `API route not found: ${route} ${procedure} ${action}`,
        })
      );
      console.timeEnd(`REQUEST TIME ${route}/${procedure}`);
      console.log("\n\n");
      return;
    }

    try {
      const result = await func.call({ context }, input?.query);

      console.timeEnd(`REQUEST TIME ${route}/${procedure}`);
      console.log("\n\n");

      if (res.writableEnded) {
        return;
      }

      if (req.method === "OPTIONS") {
        console.log("^^^ IS OPTIONS");
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
      console.timeEnd(`REQUEST TIME ${route}/${procedure}`);
      console.log("\n\n");

      console.log("ERROR");
      res.status(500).json(error({ message: "serverfejl", detail: err }));
    }
  };
}
