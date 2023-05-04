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

export type KeyCookie = string;

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

const cookies = {
  KEY_COOKIE: "sf.key",
  LINK_COOKIE: "sf.verify",
  GLOBAL_SESSION_COOKIE: "sf.session",
  GLOBAL_TOKEN: "sf.token",
  LOCAL_SESSION: "sf.local.session",
  LOCAL_TOKEN: "sf.local.token",
} as const;

type CookieName = (typeof cookies)[keyof typeof cookies];

export const {
  KEY_COOKIE,
  LINK_COOKIE,
  GLOBAL_SESSION_COOKIE: GLOBAL_SESSION_COOKIE,
  GLOBAL_TOKEN,
  LOCAL_SESSION,
  LOCAL_TOKEN,
} = cookies;

type CookieValue = {
  [KEY_COOKIE]: KeyCookie;
  [LINK_COOKIE]: LinkCookie;
  [GLOBAL_SESSION_COOKIE]: GlobalAuthSession;
  [GLOBAL_TOKEN]: GlobalAuthToken;
  [LOCAL_SESSION]: LocalAuthSession;
  [LOCAL_TOKEN]: LocalAuthToken;
};

export function serializeAuthToken(value: GlobalAuthToken) {
  return jwt.sign(
    value,
    {
      key: parseKey(process.env.PRIVATE_KEY as string, "private"),
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
>(name: T, value: string | undefined) {
  if (!value) return null;
  return jwt.verify(
    value,
    parseKey(process.env.PUBLIC_KEY as string, "public"),
    {
      algorithms: ["RS256"],
      issuer: "storyflow",
    }
  ) as CookieValue[T];
}

export function parseAuthSession<
  T extends typeof GLOBAL_SESSION_COOKIE | typeof LOCAL_SESSION
>(name: T, value: string | undefined) {
  if (!value) return null;
  return JSON.parse(atob(value)) as CookieValue[T];
}

export function parseAuthCookie<
  T extends
    | typeof GLOBAL_SESSION_COOKIE
    | typeof LOCAL_SESSION
    | typeof LINK_COOKIE
    | typeof KEY_COOKIE
>(name: T, cookieString: string | undefined) {
  const cookie = parseCookies(cookieString)[name];

  if (!cookie) {
    return null;
  }

  if (name === LINK_COOKIE || name === KEY_COOKIE) {
    return cookie as CookieValue[T];
  }

  return parseAuthSession(name, cookie) as CookieValue[T];
}

export function serializeAuthCookie<T extends CookieName>(
  name: T,
  value: CookieValue[T]
) {
  if (name === GLOBAL_TOKEN || name === LOCAL_TOKEN) {
    const options = "Path=/";

    return `${name}=${serializeAuthToken(
      value as GlobalAuthToken
    )}; ${options}`;
  } else {
    const options = "Path=/; HttpOnly; SameSite=Lax; Secure";

    if (name === LINK_COOKIE) {
      return `${name}=${value}; ${options}`;
    }

    return `${name}=${btoa(JSON.stringify(value))}; ${options}`;
  }
}

export function unsetAuthCookie<T extends CookieName>(name: T) {
  const options = "Path=/; HttpOnly; SameSite=Lax; Secure";
  return `${name}=; ${options}; Max-Age=0`;
}
