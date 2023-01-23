import { CookieParseOptions, CookieSerializeOptions } from "cookie";
import { Cookie, CookieOptions, createCookie, isCookie } from "./cookies";
import { createSession, Session } from "./session";
import { sign, unsign } from "./crypto-edge";

export interface SessionStorage {
  get(
    cookieHeader?: string | null,
    options?: CookieParseOptions
  ): Promise<Session>;
  commit(session: Session, options?: CookieSerializeOptions): Promise<string>;
  destroy(session: Session, options?: CookieSerializeOptions): Promise<string>;
}

export const createSessionStorage = ({
  cookie: cookieArg,
}: {
  cookie?: Cookie | (CookieOptions & { name?: string });
} = {}): SessionStorage => {
  let cookie = isCookie(cookieArg)
    ? cookieArg
    : createCookie(cookieArg?.name || "__session", cookieArg, { sign, unsign });

  return {
    async get(cookieHeader, options) {
      return createSession(
        (cookieHeader && (await cookie.parse(cookieHeader, options))) || {}
      );
    },
    async commit(session, options) {
      return cookie.serialize(session.data, options);
    },
    async destroy(_session, options) {
      return cookie.serialize("", {
        ...options,
        expires: new Date(0),
      });
    },
  };
};
