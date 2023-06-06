import crypto from "crypto";

export function sign(value: string, secret: string) {
  return (
    value +
    "." +
    crypto
      .createHmac("sha256", secret)
      .update(value)
      .digest("base64url")
      .replace(/\=+$/, "")
  );
}

export function unsign(input: string, secret: string) {
  const tentativeValue = input.slice(0, input.lastIndexOf("."));
  const expectedInput = sign(tentativeValue, secret);
  const expectedBuffer = Buffer.from(expectedInput);
  const inputBuffer = Buffer.from(input);
  if (
    expectedBuffer.length !== inputBuffer.length ||
    !crypto.timingSafeEqual(expectedBuffer, inputBuffer)
  ) {
    throw Error("Invalid signature");
  }
  return tentativeValue;
}

const algorithm = "aes-256-cbc";

const adjustKeyLength = (key: string) => {
  if (key.length < 32) {
    // Pad the key with zero bytes
    const paddedKey = new Uint8Array(32);
    paddedKey.set(new TextEncoder().encode(key));
    return paddedKey;
  } else if (key.length > 32) {
    // Truncate the key to the required length
    return new TextEncoder().encode(key.slice(0, 32));
  }
  return key;
};

export function encrypt(input: string, secret: string) {
  const iv = crypto.randomBytes(16);
  const key = adjustKeyLength(secret);

  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let ciphertext = cipher.update(input, "utf8", "base64url");
  ciphertext += cipher.final("base64url");
  return ciphertext + "." + iv.toString("base64url");
}

export function decrypt(input: string, secret: string) {
  const [ciphertext, ivHex] = input.split(".");
  const iv = Buffer.from(ivHex, "base64url");

  const key = adjustKeyLength(secret);

  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  let decrypted = decipher.update(ciphertext, "base64url", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

export const encode = (
  value: any,
  options: { secret?: string; encrypt?: boolean } = {}
): string => {
  const secret = options.secret;
  if (!secret) throw Error("Missing secret");
  const base64 = (input: string) => {
    if (options.encrypt) return encrypt(input, secret);
    return Buffer.from(input).toString("base64url");
  };

  try {
    return sign(base64(JSON.stringify(value)), secret);
  } catch (err) {
    console.log("FAILED ENCODING:");
    console.error(err);
    throw new Error("Could not encode value");
  }
};

export const decode = <T>(
  value: string,
  options: { secret?: string; decrypt?: boolean } = {}
): T | null => {
  const secret = options.secret;
  if (!secret) throw Error("Missing secret");

  const base64 = (input: string) => {
    if (options.decrypt) return decrypt(input, secret);
    return Buffer.from(input, "base64url").toString("utf-8");
  };

  try {
    return JSON.parse(base64(unsign(value, secret)));
  } catch (e) {
    console.error(e);
    return null;
  }
};
