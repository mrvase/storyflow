import {
  auth,
  bucket,
  collab,
  AuthOptions,
  createRouteHandler,
} from "services-api";
import { createTransport } from "nodemailer";
import { organizations } from "./organizations_mongo";
import { client } from "../../../mongo";

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

const sendEmail: AuthOptions["sendEmail"] = async (link, payload) => {
  const transport = createTransport(options.server);

  let text = `Log ind med linket: ${link}`;

  if (payload.invite) {
    text = `Du er blevet inviteret til at få adgang til storyflow.dk/${payload.invite}. Log ind med linket: ${link}`;
  }

  if (payload.register) {
    text = `Bekræft din email med linket: ${link}`;
  }

  try {
    const result = await transport.sendMail({
      to: payload.email,
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

client.set(process.env.MONGO_URL as string);

export const { GET, POST, OPTIONS } = createRouteHandler(
  {
    auth: auth({
      sendEmail,
      organizations,
    }),
    bucket: bucket({
      organizations,
    }),
    collab,
  },
  { secret: process.env.SECRET_KEY as string }
);

export const dynamic = "force-dynamic";
