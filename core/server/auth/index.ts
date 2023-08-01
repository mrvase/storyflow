export const KEY_COOKIE = "key";
export const LINK_COOKIE = "verify";
export const EMAIL_HTTP_COOKIE = "session";
export const TOKEN_HTTP_COOKIE = "server-token";

export const GLOBAL_TOKEN = "token";
export const LOCAL_TOKEN = "local-token";

export type LinkCookie = string;

export type KeyCookie = {
  slug: string;
  url: string;
  key: string;
};

export type EmailAuthCookie = {
  email: string;
};

export type AuthCookies = {
  [KEY_COOKIE]: KeyCookie;
  [LINK_COOKIE]: LinkCookie;
  [EMAIL_HTTP_COOKIE]: EmailAuthCookie;
  [TOKEN_HTTP_COOKIE]: string;
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
