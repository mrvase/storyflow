import { SessionStorage } from "@storyflow/session";
import { AuthenticateOptions, Strategy } from "./strategy";
import type { Request, Response } from "./strategy";
import { success } from "@storyflow/result";

export interface AuthenticatorOptions {
  secret: string;
  cookie?: {
    httpOnly?: boolean;
    path?: string;
    sameSite?: boolean | "lax" | "strict" | "none" | undefined;
    secure?: boolean;
  };
  sessionKey?: AuthenticateOptions["sessionKey"];
}

export const getHeader = (req: Request, name: string) => {
  if ("get" in req.headers && typeof req.headers.get === "function") {
    return req.headers.get(name) ?? undefined;
  }
  return (req.headers as Record<string, string>)[name] ?? undefined;
};

export type Authenticator<User> = ReturnType<typeof createAuthenticator<User>>;

export function createAuthenticator<User = unknown>(
  strategies: Strategy<User, any, any>[],
  sessionStorage: SessionStorage
) {
  const sessionKey = "user";

  const strategyMap = new Map<string, Strategy<User, any, any>>(
    strategies.map((el) => [el.name, el])
  );

  function use(strategy: Strategy<User, any, any>, name?: string) {
    strategyMap.set(name ?? strategy.name, strategy);
  }

  function unuse(name: string) {
    strategyMap.delete(name);
  }

  function authenticate(
    strategyName: string,
    { request, response }: { request: Request; response: Response },
    options?: Record<string, any>
  ) {
    const strategy = strategyMap.get(strategyName);
    if (!strategy) {
      throw new Error(`Strategy ${strategyName} not found.`);
    }
    return strategy.authenticate({ request, response }, sessionStorage, {
      name: strategy.name,
      sessionKey,
      ...options,
    });
  }

  async function isAuthenticated(request: Request) {
    let session = await sessionStorage.get(getHeader(request, "cookie"));
    let user: User | null = session.get(sessionKey) ?? null;
    if (user) {
      return user;
    }
    return null;
  }

  async function modifyUser(
    { request, response }: { request: Request; response: Response },
    callback: (oldUser: User) => User
  ) {
    let session = await sessionStorage.get(getHeader(request, "cookie"));
    let user: User | null = session.get(sessionKey) ?? null;

    if (!user) {
      return null;
    }

    const newUser = callback(user);

    session.set(sessionKey, newUser);
    const cookie = await sessionStorage.commit(session);
    response.setHeader("Set-Cookie", cookie);

    return newUser;
  }

  async function logout({
    request,
    response,
  }: {
    request: Request;
    response: Response;
  }) {
    let session = await sessionStorage.get(getHeader(request, "cookie"));

    response.setHeader("Set-Cookie", await sessionStorage.destroy(session));

    return success(null);
  }

  return {
    use,
    unuse,
    authenticate,
    isAuthenticated,
    modifyUser,
    logout,
  };
}
