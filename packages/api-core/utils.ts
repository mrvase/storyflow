import { NextApiRequest } from "next";

export const getHeader = (req: Request | NextApiRequest, name: string) => {
  if ("get" in req.headers && typeof req.headers.get === "function") {
    return req.headers.get(name) ?? undefined;
  }
  return (
    (req.headers as unknown as Record<string, string>)[name.toLowerCase()] ??
    undefined
  );
};
