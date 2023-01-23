import {
  createAuthenticator,
  createAuthorizer,
  createEmailStrategy,
  SendEmailOptions,
  VerifyFunction,
} from "@storyflow/auth";
import type { User } from "../types";
import { authOptions } from "./authOptions";
import clientPromise from "./mongo";

const USER_ID = "abcd";

const verify: VerifyFunction<User> = async ({
  email,
  stage,
  register,
  invite,
}) => {
  const client = await clientPromise;

  console.log("VERIFYING", stage, email, register, invite);

  const login = !register && !invite;

  const shouldVerify = stage === "verified" || login;

  /* UPSERT */
  if (shouldVerify) {
    let user: {
      email: string;
      name?: string;
      organizations?: string[];
    } | null;

    if (!login) {
      const result = await client
        .db("cms")
        .collection<{
          email: string;
          name?: string;
          organizations?: string[];
        }>("users")
        .findOneAndUpdate(
          { email },
          {
            $set: {
              email,
              ...(register && { name: register }),
            },
            ...(invite && { $addToSet: { organizations: invite } }),
          },
          { returnDocument: "after", upsert: true }
        );
      user = result.value;
    } else {
      user = await client.db("cms").collection("users").findOne<{
        email: string;
        name?: string;
        organizations?: string[];
      }>({ email });
    }

    if (!user) {
      throw new Error("User does not exist");
    }

    return {
      email,
      name: user.name ?? "",
      organizations: (user.organizations ?? []).map((slug) => ({ slug })),
    };
  }

  return {
    email,
    name: "",
    organizations: [],
  };
};

import { createTransport } from "nodemailer";

const options = {
  server: {
    host: process.env.EMAIL_SERVER_HOST as string,
    port: parseInt(process.env.EMAIL_SERVER_PORT ?? "587", 10),
    auth: {
      user: process.env.EMAIL_SERVER_USER as string,
      pass: process.env.EMAIL_SERVER_PASS as string,
    },
  },
  from: process.env.EMAIL_FROM as string,
};

const sendEmail = async ({
  email,
  invite,
  register,
  link,
  user,
}: SendEmailOptions<User>) => {
  console.log("SENDING EMAIL", { email, link, user });
  const transport = createTransport(options.server);

  let text = `Log ind med linket: ${link}`;

  if (invite) {
    text = `Du er blevet inviteret til at få adgang til Storyflow Studio. Log ind med linket: ${link}`;
  }

  if (register) {
    text = `Bekræft din email med linket: ${link}`;
  }

  try {
    const result = await transport.sendMail({
      to: email,
      from: options.from,
      subject: "Log ind på Storyflow",
      text,
    });
    const failed = result.rejected.concat(result.pending).filter(Boolean);
    if (failed.length) {
      throw "Det lykkedes ikke at sende besked.";
    }
  } catch (err) {
    console.error(err);
    throw "Ukendt fejl";
  }
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
