import {
  createAuthenticator,
  createAuthorizer,
  createEmailStrategy,
  SendEmailFunction,
  Strategy,
  VerifyFunction,
} from "@storyflow/auth";
import { error, success } from "@storyflow/result";
import type { Organization, User } from "../types";
import { authOptions } from "./authOptions";
import clientPromise from "./mongo";

const USER_ID = "abcd";

const verify: VerifyFunction<User> = async ({ email }) => {
  const client = await clientPromise;

  const user = await client
    .db("cms")
    .collection("users")
    .findOne<{ name: string; email: string; organizations?: Organization[] }>({
      email,
    });

  console.log("VERIFY USER", user);

  if (!user) {
    throw new Error("User does not exist");
  }

  return {
    email,
    name: user.name,
    organizations: user.organizations ?? [],
  };
};

const sendEmail: SendEmailFunction<User> = async ({ email, link, user }) => {
  console.log("SENDING EMAIL", { email, link, user });
  return;
};

const emailStrategy = createEmailStrategy({
  verify,
  secret: process.env.SECRET_KEY as string,
  sendEmail,
  verificationUrl: "/verify",
});

export const authenticator = createAuthenticator<User>(
  [emailStrategy],
  authOptions
);

export const authorizer = createAuthorizer(authenticator);
