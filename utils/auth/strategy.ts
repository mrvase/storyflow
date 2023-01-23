import { SessionStorage } from "@storyflow/session";
import { Result } from "@storyflow/result";
import type { IncomingHttpHeaders, OutgoingMessage } from "http";

export type Request = {
  headers: IncomingHttpHeaders | { get(name: string): string | null };
};

export type Response = {
  setHeader: OutgoingMessage["setHeader"];
};

export type AuthenticateOptions = {
  sessionKey: string;
  name: string;
};

export type StrategyVerifyCallback<User, VerifyParams> = (
  params: VerifyParams
) => Promise<User>;

export type AuthenticateCallback<User, Options = {}> = (
  context: { request: Request; response: Response },
  sessionStorage: SessionStorage,
  options: AuthenticateOptions & Options
) => Promise<Result<User>>;

export type Strategy<User, VerifyOptions, Options = {}> = {
  name: string;
  verify: StrategyVerifyCallback<User, VerifyOptions>;
  authenticate: AuthenticateCallback<User, Options>;
};
