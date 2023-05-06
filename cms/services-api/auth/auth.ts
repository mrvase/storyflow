import { error, success } from "@storyflow/result";
import { createProcedure, createRoute } from "@sfrpc/server";
import { cors as corsFactory } from "@storyflow/server/middleware";
import { getHeader } from "@storyflow/server/utils";
import {
  encrypt,
  decrypt,
  createLink,
  validateLink,
  unsetAuthCookie,
} from "@storyflow/server/auth";
import { z } from "zod";
import {
  GLOBAL_SESSION,
  GLOBAL_TOKEN,
  LINK_COOKIE,
  parseAuthCookie,
  serializeAuthCookie,
} from "@storyflow/server/auth";
import { Payload } from "@storyflow/server/auth/email";
import { createTransport } from "nodemailer";
import postgres from "postgres";
import { KEY_COOKIE } from "@storyflow/server/auth/cookies";

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
    async query(email, { req, res }) {
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

      res.setHeader(
        "Set-Cookie",
        serializeAuthCookie(LINK_COOKIE, encyptedLink)
      );

      return success(null);
    },
  }),

  verify: createProcedure({
    middleware(ctx) {
      return ctx.use(cors);
    },
    async query(_, { req, res }) {
      let token: string;
      try {
        const url = new URL(`https://storyflow.dk${req.url!}`);
        token = url.searchParams.get("token") ?? "";
      } catch {
        return error({ message: "Invalid token." });
      }

      // retrieve link from cookie and decrypt
      const SECRET = process.env.SECRET_KEY as string;

      const encryptedLink = parseAuthCookie(
        LINK_COOKIE,
        getHeader(req, "cookie")
      );

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

        res.setHeader(
          "Set-Cookie",
          serializeAuthCookie(GLOBAL_SESSION, { email })
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
    async query(_, { req }) {
      const user = parseAuthCookie(
        GLOBAL_SESSION,
        getHeader(req as any, "cookie")
      );

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
    async mutation(org, { res, req }) {
      const setCookies: string[] = [];

      try {
        const user = parseAuthCookie(
          GLOBAL_SESSION,
          getHeader(req as any, "cookie")
        );

        if (!user) {
          return error({ message: "Not authenticated" });
        }

        console.log("user", user, org);

        const setKeyCookie = async () => {
          if (!org) return;

          const current = parseAuthCookie(
            KEY_COOKIE,
            getHeader(req as any, "cookie")
          );

          if (current && current.slug === org) return current.url;

          const result = await sql<
            { slug: string; url: string }[]
          >`SELECT url FROM organizations WHERE slug = ${org};`;

          console.log(`result`, result);

          if (!result.length) return;

          const url = result[0].url;

          console.log(`${url}/.storyflow/config`);

          const json = await fetch(`${url}/.storyflow/public`).then((res) =>
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

          setCookies.push(
            serializeAuthCookie(KEY_COOKIE, {
              key: json.publicKey,
              url,
              slug: org,
            })
          );

          return url;
        };

        const url = await setKeyCookie();

        setCookies.push(
          serializeAuthCookie(
            GLOBAL_TOKEN,
            { email: user.email },
            process.env.STORYFLOW_PRIVATE_KEY as string
          )
        );

        res.setHeader("Set-Cookie", setCookies.join(", "));

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
    async mutation(_, { res }) {
      res.setHeader("Set-Cookie", unsetAuthCookie(GLOBAL_TOKEN));
      res.setHeader("Set-Cookie", unsetAuthCookie(GLOBAL_SESSION));
      return success(null);
    },
  }),
});
