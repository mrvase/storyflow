import {
  AuthenticateCallback,
  Strategy,
  StrategyVerifyCallback,
} from "./strategy";
import type { Request } from "./strategy";
import { error, success } from "@storyflow/result";
import crypto from "crypto-js";
import { getHeader } from "./authenticator";

export type Payload = {
  email: string;
  invite?: string;
  register?: string; // name
};

export type VerifyParams = Payload & {
  stage: "submitted" | "verified";
};

export type LinkPayload = Payload & {
  date: string;
};

export type SendEmailOptions<User> = Payload & {
  link: string;
  user?: User | null;
};

export type VerifyFunction<User> = StrategyVerifyCallback<User, VerifyParams>;

function getDomainURL(request: Request): string {
  const origin = getHeader(request, "origin");

  if (!origin) {
    throw new Error("Could not determine domain URL.");
  }

  return `${origin}`;
}

export function createEmailStrategy<User>({
  verify,
  sendEmail,
  secret,
  verificationUrl = "",
  linkExpirationTime = 1000 * 60 * 30,
  sessionLinkKey = "auth:link",
}: {
  verify: VerifyFunction<User>;
  sendEmail: (options: SendEmailOptions<User>) => Promise<void>;
  secret: string;
  verificationUrl?: string;
  linkExpirationTime?: number;
  sessionLinkKey?: string;
}): Strategy<User, VerifyParams, Payload> {
  const name = "email-link";

  async function createLink(
    payload_: Payload,
    domain: string,
    params?: Record<string, string>
  ): Promise<string> {
    const payload: LinkPayload = {
      ...payload_,
      date: new Date().toISOString(),
    };
    const stringToEncrypt = JSON.stringify(payload);
    const encryptedString = await encrypt(stringToEncrypt);
    const url = new URL(`${domain}${verificationUrl}`);
    Object.entries(params ?? {}).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
    url.searchParams.set("token", encryptedString);
    return url.toString();
  }

  function getLinkCode(link: string) {
    try {
      const url = new URL(link);
      return url.searchParams.get("token") ?? "";
    } catch {
      return "";
    }
  }

  /*
  const algorithm = {
    name: "AES-CBC",
  };

  function pack(buffer: ArrayBuffer) {
    // buffer is an ArrayBuffer
    return Array.from(new Uint8Array(buffer))
      .map((x) => x.toString(16).padStart(2, "0"))
      .join("");
  }

  function unpack(string: string): ArrayBuffer {
    const buffer = new ArrayBuffer(string.length / 2);
    const bufferView = new Uint8Array(buffer);
    for (let i = 0; i < string.length / 2; i++) {
      bufferView[i] = parseInt(string.slice(0 + i * 2, 2 + i * 2), 16);
    }
    return buffer;
  }

  async function getKey() {
    return await subtle.importKey(
      "jwk",
      {
        alg: "A256CBC",
        ext: true,
        k: "43B76nGucTs8ZQT_jhmsq8x6zUaoA8WV6oMOBP4tSpo",
        key_ops: ["encrypt", "decrypt"],
        kty: "oct",
      },
      { ...algorithm, length: 256 },
      true,
      ["encrypt", "decrypt"]
    );
  }

  async function encrypt(value: string): Promise<string> {
    const key = await getKey();
    const encoder = new TextEncoder();
    const buffer = await subtle.encrypt(
      { ...algorithm, iv: new Uint8Array(16) },
      key,
      encoder.encode(value)
    );
    return pack(buffer);
  }

  async function decrypt(value: string): Promise<string> {
    const key = await getKey();
    const decoder = new TextDecoder();
    return decoder.decode(
      await subtle.decrypt(
        { ...algorithm, iv: new Uint8Array(16) },
        key,
        unpack(value)
      )
    );
  }
  */

  async function encrypt(value: string): Promise<string> {
    return crypto.AES.encrypt(value, secret).toString();
  }

  async function decrypt(value: string): Promise<string> {
    const bytes = crypto.AES.decrypt(value, secret);
    return bytes.toString(crypto.enc.Utf8);
  }

  async function validateLink(linkCode: string, sessionLink: string) {
    const sessionLinkCode = getLinkCode(sessionLink);

    let payload: Payload;
    let date: string;

    try {
      const decryptedString = await decrypt(linkCode);
      ({ date, ...payload } = JSON.parse(decryptedString) as LinkPayload);
    } catch (error: unknown) {
      console.error(error);
      throw new Error("Sign in link invalid. Please request a new one. [1]");
    }

    if (typeof payload.email !== "string") {
      throw new TypeError(
        "Sign in link invalid. Please request a new one. [2]"
      );
    }

    if (!sessionLinkCode) {
      throw new Error("Sign in link invalid. Please request a new one. [3]");
    }

    console.log("CODES", linkCode, sessionLinkCode);

    if (linkCode !== sessionLinkCode) {
      throw new Error(
        `You must open the magic link on the same device it was created from for security reasons. Please request a new link.`
      );
    }

    if (typeof date !== "string") {
      throw new TypeError(
        "Sign in link invalid. Please request a new one. [4]"
      );
    }

    const linkCreationDate = new Date(date);
    const expirationTime = linkCreationDate.getTime() + linkExpirationTime;

    if (Date.now() > expirationTime) {
      throw new Error("Magic link expired. Please request a new one. [5]");
    }

    return payload;
  }

  const authenticate: AuthenticateCallback<
    User,
    (Payload & { params?: Record<string, string> }) | { token: string }
  > = async function ({ request, response }, sessionStorage, options) {
    const session = await sessionStorage.get(getHeader(request, "cookie"));

    // STAGE 1: SENDING LINK

    if ("email" in options) {
      // get the email address from the request body
      const { params, ...payload } = options;
      const { email } = payload;

      // if it doesn't have an email address,
      if (!email || typeof email !== "string") {
        return error({ message: "Invalid input", status: 400 });
      }

      try {
        if (!/.+@.+/u.test(email)) {
          throw new Error("A valid email is required.");
        }

        const user = await verify({
          ...payload,
          stage: "submitted",
        }).catch(() => null);

        if (!user) {
          throw new Error("Could not send email.");
        }

        const domain = getDomainURL(request);

        const link = await createLink(payload, domain, params);

        await sendEmail({
          ...payload,
          link,
          user: user,
        });

        session.set(sessionLinkKey, await encrypt(link));
        const cookie = await sessionStorage.commit(session);
        response.setHeader("Set-Cookie", cookie);

        return success(user);
      } catch (err) {
        return error({
          message: "Could not send email.",
          detail: err,
          status: 500,
        });
      }
    }

    // STAGE 2: VERIFYING LINK

    try {
      const link = session.get(sessionLinkKey) ?? "";
      const decrypted = await decrypt(link);
      const payload = await validateLink(options.token, decrypted);
      const user = await verify({ ...payload, stage: "verified" });

      // remove the magic link from the session
      session.unset(sessionLinkKey);
      session.set(options.sessionKey, user);
      const cookie = await sessionStorage.commit(session);
      response.setHeader("Set-Cookie", cookie);

      return success(user);
    } catch (err) {
      console.error(err);
      return error({
        message:
          typeof err === "string"
            ? err
            : err instanceof Error
            ? err.message
            : "Could not verify account",
        status: 500,
      });
    }
  };

  return {
    name,
    verify,
    authenticate,
  };
}
