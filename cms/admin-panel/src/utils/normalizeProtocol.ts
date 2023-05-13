import { isDev } from "./isDev";

export function normalizeProtocol(url: string) {
  const protocol = isDev ? "http://" : "https://";
  return `${protocol}${url.replace(/https?:\/\//, "")}`;
}
