import jwt from "jsonwebtoken";
import { parseKey } from "./keys";

export function parseCookies(rc: string | undefined): {
  [key: string]: string;
} {
  const list: Record<string, string> = {};

  if (rc) {
    rc.split(";").forEach((cookie) => {
      const parts = cookie.split("=");
      list[parts.shift()!.trim()] = decodeURI(parts.join("="));
    });
  }

  return list;
}

export type LinkCookie = string;

export type KeyCookie = {
  slug: string;
  url: string;
  key: string;
};

export type GlobalAuthSession = {
  email: string;
};

export type GlobalAuthToken = {
  email: string;
};

export type LocalAuthSession = {
  email: string;
};

export type LocalAuthToken = {
  email: string;
};

export const KEY_COOKIE = "key";
export const LINK_COOKIE = "verify";
export const GLOBAL_SESSION_COOKIE = "session";
export const GLOBAL_TOKEN = "token";
export const LOCAL_SESSION_COOKIE = "local-session";
export const LOCAL_TOKEN = "local-token";

export type AuthCookies = {
  [KEY_COOKIE]: KeyCookie;
  [LINK_COOKIE]: LinkCookie;
  [GLOBAL_SESSION_COOKIE]: GlobalAuthSession;
  [LOCAL_SESSION_COOKIE]: LocalAuthSession;
  [GLOBAL_TOKEN]: string;
  [LOCAL_TOKEN]: string;
};

export type AuthTokens = {
  [GLOBAL_TOKEN]: GlobalAuthToken;
  [LOCAL_TOKEN]: LocalAuthToken;
};

export function serializeAuthToken(
  value: GlobalAuthToken | LocalAuthToken,
  key: string
) {
  return jwt.sign(
    value,
    {
      key: parseKey(key, "private"),
      passphrase: "top secret",
    },
    {
      algorithm: "RS256",
      expiresIn: 60,
      issuer: "storyflow",
    }
  );
}

export function parseAuthToken<
  T extends typeof GLOBAL_TOKEN | typeof LOCAL_TOKEN
>(name: T, value: string | null | undefined, key: string) {
  if (!value) return;
  try {
    return jwt.verify(value, parseKey(key, "public"), {
      algorithms: ["RS256"],
      issuer: "storyflow",
    }) as AuthTokens[T];
  } catch (err) {
    return;
  }
}

/*
export function parseAuthSession<
  T extends
    | typeof GLOBAL_SESSION_COOKIE
    | typeof LOCAL_SESSION_COOKIE
    | typeof KEY_COOKIE
>(name: T, value: string | undefined) {
  if (!value) return null;
  return JSON.parse(atob(value)) as CookieValue[T];
}

export function parseAuthCookie<
  T extends
    | typeof GLOBAL_SESSION_COOKIE
    | typeof LOCAL_SESSION_COOKIE
    | typeof LINK_COOKIE
    | typeof KEY_COOKIE
>(name: T, cookieString: string | undefined) {
  const cookie = parseCookies(cookieString)[name];

  if (!cookie) {
    return null;
  }

  if (name === LINK_COOKIE) {
    return cookie as CookieValue[T];
  }

  return parseAuthSession(name, cookie) as CookieValue[T];
}

export function serializeAuthCookie<T extends CookieName>(
  name: T,
  value: CookieValue[T],
  key?: string
) {
  if (name === GLOBAL_TOKEN || name === LOCAL_TOKEN) {
    const options = "Path=/";

    return `${name}=${serializeAuthToken(
      value as GlobalAuthToken,
      key!
    )}; ${options}`;
  } else {
    const options = "Path=/; HttpOnly; SameSite=Lax; Secure";

    if (name === LINK_COOKIE) {
      return `${name}=${value}; ${options}`;
    }

    return `${name}=${btoa(JSON.stringify(value))}; ${options}`;
  }
}
*/
