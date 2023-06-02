import { z } from "zod";
import {
  GLOBAL_SESSION_COOKIE,
  GLOBAL_TOKEN,
  LINK_COOKIE,
  KEY_COOKIE,
  AuthCookies,
  serializeAuthToken,
  parseAuthToken,
  LOCAL_TOKEN,
} from "@storyflow/server/auth";
import { cors } from "../globals";
import { AppReference } from "@storyflow/shared/types";
import { emailAuth, procedure } from "@storyflow/server/rpc";
import { RPCError, isError } from "@nanorpc/server";

const domain =
  process.env.NODE_ENV === "development" ? "http://localhost:5173" : "";

type LinkPayload = {
  email: string;
  invite?: string;
  register?: string; // name
  date: string;
};

type AuthOptions = {
  sendEmail: (link: string, payload: LinkPayload) => Promise<void>;
  organizations: {
    insertUser: (email: string) => Promise<void>;
    getOrganizationUrl: (slug: string) => Promise<string | undefined>;
    addNewOrganizationToUser: (
      email: string,
      organization: { slug: string; url: string }
    ) => Promise<void>;
    addExistingOrganizationToUser: (
      email: string,
      organization: { slug: string }
    ) => Promise<void>;
    getUserWithOrganizations: (email: string) => Promise<{
      email: string;
      organizations: { url: string; slug: string }[];
    }>;
  };
};

export const auth = ({ sendEmail, organizations }: AuthOptions) => {
  return {
    sendEmail: procedure
      .use(cors)
      .schema(z.object({ email: z.string(), next: z.string().optional() }))
      .mutate(async ({ email, next }, { res, encode }) => {
        if (!/.+@.+/u.test(email)) {
          return new RPCError({
            code: "INVALID_INPUT",
            status: 403,
            message: "A valid email is required.",
          });
        }

        const payload: LinkPayload = {
          email,
          date: new Date().toISOString(),
        };

        const token = encode!(payload, { encrypt: true });

        const path = `${process.env.BASE_URL}/verify`;

        const url = new URL(path);
        url.searchParams.set("token", token);
        if (next) {
          url.searchParams.set("next", next);
        }
        const link = url.toString();

        await sendEmail(link, payload);

        res!.cookies<AuthCookies>().set(LINK_COOKIE, link, {
          path: "/",
          sameSite: "lax",
          secure: true,
          httpOnly: true,
          encrypt: true,
        });

        return null;
      }),

    verify: procedure.use(cors).query(async (_, { req, res, decode }) => {
      const tryVerifying = async () => {
        let next: string | null;
        let token: string;

        try {
          const url = new URL(`https://storyflow.dk${req!.url}`);
          token = url.searchParams.get("token") ?? "";
          next = url.searchParams.get("next") ?? "";
        } catch {
          return new RPCError({
            code: "UNAUTHORIZED",
            status: 401,
            message: "Invalid token.",
          });
        }

        const link = req!.cookies<AuthCookies>().get(LINK_COOKIE)?.value;

        console.log("LINK", link);

        if (!link) {
          return new RPCError({
            code: "SERVER_ERROR",
            status: 400,
            message: "Invalid link.",
          });
        }

        let serverToken: string;
        try {
          const url = new URL(link);
          serverToken = url.searchParams.get("token") ?? "";
        } catch {
          return new RPCError({
            code: "SERVER_ERROR",
            status: 500,
            message: "Invalid device.",
          });
        }

        console.log("* LINK", { token, serverToken });

        if (token !== serverToken) {
          return new RPCError({
            code: "UNAUTHORIZED",
            status: 401,
            message: "Invalid token.",
          });
        }

        let email: string;
        let date: string;

        try {
          ({ email, date } = decode!(token, { decrypt: true }) as LinkPayload);
        } catch (err: unknown) {
          return new RPCError({
            code: "SERVER_ERROR",
            message: "Sign in link invalid. Please request a new one. [1]",
          });
        }

        if (typeof email !== "string") {
          return new RPCError({
            code: "SERVER_ERROR",
            message: "Sign in link invalid. Please request a new one. [2]",
          });
        }

        if (typeof date !== "string") {
          return new RPCError({
            code: "SERVER_ERROR",
            message: "Sign in link invalid. Please request a new one. [4]",
          });
        }

        const linkCreationDate = new Date(date);
        const expirationTime = linkCreationDate.getTime() + 10 * 60 * 1000;

        if (Date.now() > expirationTime) {
          return new RPCError({
            code: "SERVER_ERROR",
            message: "Magic link expired. Please request a new one. [5]",
          });
        }

        await organizations.insertUser(email);

        res!
          .cookies<AuthCookies>()
          .set(
            GLOBAL_SESSION_COOKIE,
            { email },
            { path: "/", sameSite: "lax", secure: true, httpOnly: true }
          );

        res!.cookies<AuthCookies>().delete(LINK_COOKIE, {
          path: "/",
          sameSite: "lax",
          secure: true,
          httpOnly: true,
          encrypt: true,
        });

        return next;
      };

      const result = await tryVerifying();

      if (isError(result)) {
        res!.headers.set("Location", `${domain}/?success=false`);
      } else {
        const slug = result;
        res!.headers.set("Location", `${domain}/${slug ?? ""}?success=true`);
      }

      return null;
    }),

    addOrganization: procedure
      .use(cors)
      .use(emailAuth)
      .schema(
        z.object({
          slug: z.string(),
          url: z.string().optional(),
        })
      )
      .mutate(async ({ slug, url }, { req, email }) => {
        try {
          if (url) {
            await organizations.addNewOrganizationToUser(email, { slug, url });
          } else {
            await organizations.addExistingOrganizationToUser(email, { slug });
          }
          return null;
        } catch (err) {
          console.log(slug, url, err);
          return new RPCError({ code: "SERVER_ERROR" });
        }
      }),

    getOrganizations: procedure
      .use(cors)
      .use(emailAuth)
      .query(async (_, { email }) => {
        const data = await organizations.getUserWithOrganizations(email);
        return data;
      }),

    authenticate: procedure
      .use(cors)
      .schema(
        z.object({
          organization: z.object({
            slug: z.string().nullable(),
            url: z.string().nullable(),
          }),
          returnConfig: z.boolean(),
        })
      )
      .mutate(async ({ organization, returnConfig }, { req, res }) => {
        console.log("AUTHENTICATING");

        const cookies = {
          req: req!.cookies<AuthCookies>(),
          res: res!.cookies<AuthCookies>(),
        };

        const user = cookies.req.get(GLOBAL_SESSION_COOKIE)?.value;

        if (!user) {
          return new RPCError({
            code: "UNAUTHORIZED",
            message: "Not authenticated",
            status: 401,
          });
        }

        try {
          const getData = async (url: string, key: string | undefined) => {
            const token = serializeAuthToken(
              { email: user.email },
              process.env.STORYFLOW_PRIVATE_KEY as string
            );

            const data = await fetch(`${url}/api/admin/authenticate`, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                input: { key: !key, config: returnConfig },
              }),
            }).then(
              (res) =>
                res.json() as Promise<
                  | {
                      token: string;
                      key?: string;
                      config?: {
                        apps: AppReference[];
                        workspaces: {
                          name: string;
                        }[];
                      };
                    }
                  | { error: string }
                >
            );

            if ("error" in data) {
              return;
            }

            if (
              !data ||
              typeof data !== "object" ||
              !("token" in data) ||
              typeof data.token !== "string"
            ) {
              return;
            }

            if (!key) {
              if (
                !("key" in data) ||
                !data.key ||
                typeof data.key !== "string"
              ) {
                return;
              }
              key = data.key;
            }

            const validated = parseAuthToken(LOCAL_TOKEN, data.token, key);

            if (!validated || validated.email !== user.email) {
              return;
            }

            if (
              returnConfig &&
              (!("config" in data) || typeof data.config !== "object")
            ) {
              return;
            }

            return data;
          };

          const keyCookie = cookies.req.get(KEY_COOKIE)?.value;

          const hasKey =
            keyCookie &&
            keyCookie.slug === organization.slug &&
            (!organization.url || keyCookie.url === organization.url);

          let url: string | undefined;

          if (hasKey) {
            // we only get here if organization.slug is something
            url = keyCookie.url;
          } else if (organization.slug && organization.url) {
            // and the same here
            // THIS IS IF URL IS PRESET
            url = organization.url;
          } else if (organization.slug) {
            // and the same here
            url = await organizations.getOrganizationUrl(organization.slug);
          }

          // so now organization.slug is defined

          if (!url) {
            // catched below
            throw "";
          }

          const data = await getData(url, hasKey ? keyCookie.key : undefined);

          if (!data) {
            // catched below
            throw "";
          }

          if (!hasKey && data.key) {
            // stays on the server
            cookies.res.set(
              KEY_COOKIE,
              {
                key: data.key,
                url,
                slug: organization.slug!,
              },
              { path: "/", sameSite: "strict", secure: true, httpOnly: true }
            );
          }

          cookies.res.set(LOCAL_TOKEN, data.token, {
            path: "/",
            sameSite: "strict",
            secure: true,
          });

          return {
            user: { email: user.email },
            config: data.config ?? null,
            url,
          };
        } catch (err) {
          return {
            user: { email: user.email },
            config: null,
            url: null,
          };
        }
      }),

    logout: procedure.use(cors).mutate(async (_, { res }) => {
      res!.cookies<AuthCookies>().delete(GLOBAL_SESSION_COOKIE, {
        path: "/",
        sameSite: "lax",
        secure: true,
        httpOnly: true,
      });
      res!.cookies<AuthCookies>().delete(GLOBAL_TOKEN, {
        path: "/",
        sameSite: "strict",
        secure: true,
      });
      return null;
    }),
  };
};
