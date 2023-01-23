const encoder = new TextEncoder();
const crypto = globalThis.crypto;

export const sign = async (value: string, secret: string) => {
  let key = await createKey(secret, ["sign"]);
  let data = encoder.encode(value);
  let signature = await crypto.subtle.sign("HMAC", key, data);
  let hash = btoa(
    String.fromCharCode(...Array.from(new Uint8Array(signature)))
  ).replace(/=+$/, "");

  return value + "." + hash;
};

export const unsign = async (signed: string, secret: string) => {
  let index = signed.lastIndexOf(".");
  let value = signed.slice(0, index);
  let hash = signed.slice(index + 1);

  let key = await createKey(secret, ["verify"]);
  let data = encoder.encode(value);
  let signature = byteStringToUint8Array(atob(hash));
  let valid = await crypto.subtle.verify("HMAC", key, signature, data);

  console.log("UNSIGNING", signed, secret, valid);

  return valid ? value : false;
};

function byteStringToUint8Array(byteString: string): Uint8Array {
  let array = new Uint8Array(byteString.length);

  for (let i = 0; i < byteString.length; i++) {
    array[i] = byteString.charCodeAt(i);
  }

  return array;
}

async function createKey(
  secret: string,
  usages: CryptoKey["usages"]
): Promise<CryptoKey> {
  let key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    usages
  );

  return key;
}
