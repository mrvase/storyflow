import {
  createAuthenticator,
  createAuthorizer,
  createEmailStrategy,
  SendEmailOptions,
  VerifyFunction,
} from "@storyflow/auth";
import { createSessionStorage } from "@storyflow/session";
import { clientPromise } from "../mongo/mongoClient";

const verify: VerifyFunction<User> = async ({
  email,
  stage,
  register,
  invite,
}) => {
  const client = await clientPromise;

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

    console.log("VERIFIED USER", user);

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
import { cookieOptions } from "../cookie-options";
import type { User } from "../types";

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
}: SendEmailOptions<{ email: string; name: string }>) => {
  console.log("SENDING EMAIL", { email, link, user });
  const transport = createTransport(options.server);

  let text = `Log ind med linket: ${link}`;

  if (invite) {
    text = `Du er blevet inviteret til at få adgang til storyflow.dk/${invite}. Log ind med linket: ${link}`;
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

const sessionStorage = createSessionStorage({
  cookie: cookieOptions,
});

export const authenticator = createAuthenticator<User>(
  [emailStrategy],
  sessionStorage
);

export const authorizer = createAuthorizer(authenticator);
