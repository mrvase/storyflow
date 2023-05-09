import {
  AuthTokens,
  GLOBAL_TOKEN,
  GlobalAuthToken,
  LOCAL_TOKEN,
  LocalAuthToken,
} from ".";
import jwt from "jsonwebtoken";

export const parseKey = (key: string, type: "public" | "private") => {
  return (
    `-----BEGIN ${
      type === "public" ? "PUBLIC" : "ENCRYPTED PRIVATE"
    } KEY-----\n` +
    key.match(/.{1,64}/g)!.join("\n") +
    `\n-----END ${type === "public" ? "PUBLIC" : "ENCRYPTED PRIVATE"} KEY-----`
  );
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
