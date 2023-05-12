export const KEY_COOKIE = "key";
export const LINK_COOKIE = "verify";
export const GLOBAL_SESSION_COOKIE = "session";
export const LOCAL_SESSION_COOKIE = "local-session";

export const GLOBAL_TOKEN = "token";
export const LOCAL_TOKEN = "local-token";

export type LinkCookie = string;

export type KeyCookie = {
  slug: string;
  url: string;
  key: string;
};

export type GlobalAuthSession = {
  email: string;
};

export type LocalAuthSession = {
  email: string;
};

export type AuthCookies = {
  [KEY_COOKIE]: KeyCookie;
  [LINK_COOKIE]: LinkCookie;
  [GLOBAL_SESSION_COOKIE]: GlobalAuthSession;
  [LOCAL_SESSION_COOKIE]: LocalAuthSession;
  [GLOBAL_TOKEN]: string;
  [LOCAL_TOKEN]: string;
};

export type GlobalAuthToken = {
  email: string;
};

export type LocalAuthToken = {
  email: string;
};

export type AuthTokens = {
  [GLOBAL_TOKEN]: GlobalAuthToken;
  [LOCAL_TOKEN]: LocalAuthToken;
};

export { parseAuthToken, serializeAuthToken } from "./tokens";
