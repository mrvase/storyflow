import cookieSignature from "cookie-signature";

export const sign = async (value: string, secret: string) => {
  return cookieSignature.sign(value, secret);
};

export const unsign = async (signed: string, secret: string) => {
  return cookieSignature.unsign(signed, secret);
};
