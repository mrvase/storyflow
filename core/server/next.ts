import { NextRequest, NextResponse } from "next/server";
import { handleRequest } from "@storyflow/rpc-server";
import { API, RPCRequest } from "@storyflow/rpc-server/types";
import type { NextApiRequest, NextApiResponse } from "next";
export type { NextRequest, NextResponse, NextApiRequest, NextApiResponse };

export const createAPIRoute = <T extends API>(
  router: T,
  options: {
    route?: string;
    procedure?: string;
    secret?: string;
  } = {}
) => {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    const { route, procedure } = req.query;

    const request: RPCRequest & { body?: any } = {
      method: req.method as "GET" | "POST" | "OPTIONS",
      url: req.url!,
      headers: new Headers(
        Object.entries(req.headers).filter(
          // misses set-cookie which can be an array
          // but this is not used on request headers.
          (el): el is [string, string] => typeof el[1] === "string"
        )
      ),
      route: options.route ?? (route as string),
      procedure: options.procedure ?? (procedure as string),
      body: req.body,
    };

    const { init, data } = await handleRequest(request, router, options);

    const headers: string[] = [];
    init.headers.forEach((_, key) => headers.push(key));

    init.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    res.status(init.status).json(data);

    res.end();
  };
};

export const createRouteHandler = <T extends API>(
  router: T,
  options: {
    route?: string;
    procedure?: string;
    secret?: string;
  } = {}
) => {
  const createEndpoint =
    (method: "GET" | "POST" | "OPTIONS") =>
    async (req: NextRequest, context: { params: Record<string, string> }) => {
      const { route, procedure } = context?.params ?? {};

      const headers: any[] = [];
      req.headers.forEach(
        (value, key) => key !== "cookie" && headers.push([key, value])
      );

      let body;

      if (method === "POST") {
        try {
          body = await req.json();
        } catch (err) {}
      }

      const request: RPCRequest & { body?: any } = {
        method,
        url: req.url,
        headers: req.headers,
        route: options.route ?? route,
        procedure: options.procedure ?? procedure,
        body,
      };

      const { init, data } = await handleRequest(request, router, options);

      if (!data) {
        return new Response(null, init);
      }

      return NextResponse.json(data, init);
    };

  return {
    GET: createEndpoint("GET"),
    POST: createEndpoint("POST"),
    OPTIONS: createEndpoint("OPTIONS"),
  };
};
