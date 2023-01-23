import { AuthenticatorOptions } from "@storyflow/auth";

const authOptionsDev: AuthenticatorOptions = {
  secret: process.env.SECRET_KEY as string,
  cookie: {
    sameSite: false,
    httpOnly: false,
  },
  sessionKey: "user",
};

const authOptionsProd: AuthenticatorOptions = {
  secret: process.env.SECRET_KEY as string,
  cookie: {},
  sessionKey: "user",
};

export const authOptions =
  process.env.NODE_ENV === "production" ? authOptionsProd : authOptionsDev;