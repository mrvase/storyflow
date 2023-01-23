import cookieSignature from "cookie-signature";

export const sign = async (value: string, secret: string) => {
  return cookieSignature.sign(value, secret);
};

export const unsign = async (signed: string, secret: string) => {
  return cookieSignature.unsign(signed, secret);
};

function encodeData(value: any): string {
  return Buffer.from(JSON.stringify(value)).toString("base64"); // btoa(JSON.stringify(value));
}

function decodeData(value: string): any {
  try {
    return JSON.parse(Buffer.from(value, "base64").toString()); // atob(value)
  } catch (error) {
    return {};
  }
}

export async function encodeCookieValue(
  value: any,
  secrets: string[]
): Promise<string> {
  let encoded = encodeData(value);

  if (secrets.length > 0) {
    encoded = await sign(encoded, secrets[0]);
  }

  return encoded;
}

export async function decodeCookieValue(
  value: string,
  secrets: string[]
): Promise<any> {
  if (secrets.length > 0) {
    for (let secret of secrets) {
      let unsignedValue = await unsign(value, secret);
      if (unsignedValue !== false) {
        return decodeData(unsignedValue);
      }
    }

    return null;
  }

  return decodeData(value);
}
