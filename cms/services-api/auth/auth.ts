import { error, success } from "@storyflow/rpc-server/result";
import { createProcedure, createRoute } from "@storyflow/rpc-server";
import { cors as corsFactory } from "@storyflow/server/middleware";
import { getHeader } from "@storyflow/server/utils";
import {
  encrypt,
  decrypt,
  createLink,
  validateLink,
} from "@storyflow/server/auth";
import { z } from "zod";
import {
  GLOBAL_SESSION,
  GLOBAL_TOKEN,
  LINK_COOKIE,
} from "@storyflow/server/auth";
import { Payload } from "@storyflow/server/auth/email";
import { createTransport } from "nodemailer";
import postgres from "postgres";
import {
  AuthCookies,
  KEY_COOKIE,
  serializeAuthToken,
} from "@storyflow/server/auth/cookies";

const sql = postgres(process.env.PGCONNECTION as string, { ssl: "require" });

const cors = corsFactory(["http://localhost:3000", "http://localhost:5173"]);

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

const sendLinkByEmail = async (link: string, payload: Payload) => {
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

export const auth = createRoute({
  sendEmail: createProcedure({
    middleware(ctx) {
      return ctx.use(cors);
    },
    schema() {
      return z.string();
    },
    async query(email, { request, response }) {
      if (!/.+@.+/u.test(email)) {
        throw new Error("A valid email is required.");
      }

      const SECRET = process.env.SECRET_KEY as string;

      const link = await createLink(
        "http://localhost:3000/verify",
        { email },
        { secret: SECRET }
      );

      const encyptedLink = await encrypt(link, SECRET);

      console.log("ENCRYPTED LINK", encyptedLink);

      await sendLinkByEmail(link, { email });

      response.cookies<AuthCookies>().set(LINK_COOKIE, encyptedLink, {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: true,
      });

      return success(null);
    },
  }),

  verify: createProcedure({
    middleware(ctx) {
      return ctx.use(cors);
    },
    async query(_, { request, response }) {
      let token: string;
      try {
        const url = new URL(`https://storyflow.dk${request.url}`);
        token = url.searchParams.get("token") ?? "";
      } catch {
        return error({ message: "Invalid token." });
      }

      // retrieve link from cookie and decrypt
      const SECRET = process.env.SECRET_KEY as string;

      const encryptedLink = request
        .cookies<AuthCookies>()
        .get(LINK_COOKIE)?.value;

      if (!encryptedLink) {
        return error({ message: "Invalid link" });
      }

      const link = await decrypt(encryptedLink, SECRET);

      let serverToken: string;
      try {
        const url = new URL(link);
        serverToken = url.searchParams.get("token") ?? "";
      } catch {
        return error({ message: "Invalid device" });
      }

      console.log("* LINK", token, serverToken);

      if (token !== serverToken) {
        return error({ message: "Invalid token" });
      }

      try {
        const payload = await validateLink(token, {
          secret: SECRET,
          expires: 10 * 60 * 1000,
        });

        const email = payload.email;

        await sql`insert into users (email) values (${email}) on conflict do nothing;`;

        response
          .cookies<AuthCookies>()
          .set(
            GLOBAL_SESSION,
            { email },
            { path: "/", httpOnly: true, sameSite: "lax", secure: true }
          );

        return success(null);
      } catch (err) {
        console.log(err);
        return error({ message: "Failed" });
      }
    },
  }),

  addOrganization: createProcedure({
    middleware(ctx) {
      return ctx.use(cors);
    },
    schema() {
      return z.object({
        slug: z.string(),
        url: z.string().optional(),
      });
    },
    async mutation({ slug, url }) {
      const email = "martin@rvase.dk";
      try {
        if (url) {
          const result = await sql`
WITH new_org AS (
    INSERT INTO organizations (slug, url) VALUES (${slug}, ${url})
    RETURNING id
)
UPDATE users SET organizations = array_append(organizations, (SELECT id FROM new_org)) WHERE email = ${email}
RETURNING (SELECT id FROM new_org);
`;
          console.log("A", slug, url, result);
        } else {
          const result = await sql`
UPDATE users SET organizations = array_append(organizations, (SELECT id FROM new_org)) WHERE email = ${email}          
`;
          console.log("B", slug, result);
        }
      } catch (err) {
        console.log(slug, url, err);
        return error({ message: "Failed", detail: err });
      }
    },
  }),

  getOrganizations: createProcedure({
    middleware(ctx) {
      return ctx.use(cors);
    },
    async query(_, { request, response }) {
      const user = request.cookies<AuthCookies>().get(GLOBAL_SESSION)?.value;

      if (!user) {
        return error({ message: "Not authenticated" });
      }

      const result = await sql<{ slug: string | null; url: string | null }[]>`
SELECT u.*, o.*
FROM Users u
LEFT JOIN Organizations o ON o.id = ANY (u.organizations)
WHERE u.email = ${user.email};
`;

      const organizations = result
        .filter(
          (el): el is { slug: string; url: string } =>
            el.slug !== null && el.url !== null
        )
        .map(({ slug, url }) => ({ slug, url }));

      const data = { email: user.email, organizations };

      return success(data);
    },
  }),

  authenticate: createProcedure({
    middleware(ctx) {
      return ctx.use(cors);
    },
    schema() {
      return z.string();
    },
    async mutation(org, { request, response }) {
      try {
        const user = request.cookies<AuthCookies>().get(GLOBAL_SESSION)?.value;

        if (!user) {
          return error({ message: "Not authenticated" });
        }

        console.log("user", user, org);

        const setKeyCookie = async () => {
          if (!org) return;

          const current = request.cookies<AuthCookies>().get(KEY_COOKIE)?.value;

          if (current && current.slug === org) return current.url;

          const result = await sql<
            { slug: string; url: string }[]
          >`SELECT url FROM organizations WHERE slug = ${org};`;

          if (!result.length) return;

          const url = result[0].url;

          const json = await fetch(`${url}/storyflow.json`).then((res) =>
            res.json()
          );

          if (
            !json ||
            typeof json !== "object" ||
            !("publicKey" in json) ||
            typeof json.publicKey !== "string"
          ) {
            return;
          }

          response.cookies<AuthCookies>().set(
            KEY_COOKIE,
            {
              key: json.publicKey,
              url,
              slug: org,
            },
            { path: "/", httpOnly: true, sameSite: "lax", secure: true }
          );

          return url;
        };

        const url = await setKeyCookie();

        response
          .cookies<AuthCookies>()
          .set(
            GLOBAL_TOKEN,
            serializeAuthToken(
              { email: user.email },
              process.env.STORYFLOW_PRIVATE_KEY as string
            ),
            { path: "/" }
          );

        return success({ user: { email: user.email }, url: url ?? null });
      } catch (err) {
        console.log(err);
        return error({ message: "Lykkedes ikke", detail: err });
      }
    },
  }),

  /*
  getOrganizationKey: createProcedure({
    middleware(ctx) {
      return ctx.use(cors);
    },
    schema() {
      return z.string();
    },
    async query(org, { req }) {
    }
  }),
  */

  logout: createProcedure({
    middleware(ctx) {
      return ctx.use(cors);
    },
    async mutation(_, { response }) {
      response.cookies<AuthCookies>().delete(GLOBAL_TOKEN);
      response.cookies<AuthCookies>().delete(GLOBAL_SESSION);
      return success(null);
    },
  }),
});
