import crypto from "crypto-js";

export type Payload = {
  email: string;
  invite?: string;
  register?: string; // name
};

export type LinkPayload = Payload & {
  date: string;
};

export async function encrypt(value: string, secret: string): Promise<string> {
  return crypto.AES.encrypt(value, secret).toString();
}

export async function decrypt(value: string, secret: string): Promise<string> {
  const bytes = crypto.AES.decrypt(value, secret);
  return bytes.toString(crypto.enc.Utf8);
}

export async function createLink(
  path: string,
  payload: Payload,
  options: {
    secret: string;
    params?: Record<string, string>;
  }
): Promise<string> {
  const token = await encrypt(
    JSON.stringify({
      ...payload,
      date: new Date().toISOString(),
    }),
    options.secret
  );

  const url = new URL(path);
  Object.entries(options.params ?? {}).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  url.searchParams.set("token", token);
  return url.toString();
}

export async function validateLink(
  token: string,
  options: {
    secret: string;
    expires: number;
  }
) {
  let payload: Payload;
  let date: string;

  try {
    ({ date, ...payload } = JSON.parse(
      await decrypt(token, options.secret)
    ) as LinkPayload);
  } catch (error: unknown) {
    console.error(error);
    throw new Error("Sign in link invalid. Please request a new one. [1]");
  }

  if (typeof payload.email !== "string") {
    throw new TypeError("Sign in link invalid. Please request a new one. [2]");
  }

  if (typeof date !== "string") {
    throw new TypeError("Sign in link invalid. Please request a new one. [4]");
  }

  const linkCreationDate = new Date(date);
  const expirationTime = linkCreationDate.getTime() + options.expires;

  if (Date.now() > expirationTime) {
    throw new Error("Magic link expired. Please request a new one. [5]");
  }

  return payload;
}
