import {
  Result,
  error,
  isError,
  success,
  unwrap,
} from "@storyflow/rpc-server/result";
import { createProcedure, createRoute } from "@storyflow/rpc-server";
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
import { emailAuth } from "@storyflow/server/middleware/auth";

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
  return createRoute({
    sendEmail: createProcedure({
      middleware(ctx) {
        return ctx.use(cors);
      },
      schema() {
        return z.object({ email: z.string(), next: z.string().optional() });
      },
      async mutation({ email, next }, { response, encode }) {
        if (!/.+@.+/u.test(email)) {
          throw new Error("A valid email is required.");
        }

        const payload: LinkPayload = {
          email,
          date: new Date().toISOString(),
        };

        const token = encode(payload, { encrypt: true });

        const path = `${process.env.BASE_URL}/verify`;

        const url = new URL(path);
        url.searchParams.set("token", token);
        if (next) {
          url.searchParams.set("next", next);
        }
        const link = url.toString();

        await sendEmail(link, payload);

        response.cookies<AuthCookies>().set(LINK_COOKIE, link, {
          path: "/",
          sameSite: "lax",
          secure: true,
          httpOnly: true,
          encrypt: true,
        });

        return success(null);
      },
    }),

    verify: createProcedure({
      middleware(ctx) {
        return ctx.use(cors);
      },
      async query(_, { request, response, decode }) {
        let token: string;
        let next: string | null;
        try {
          const url = new URL(`https://storyflow.dk${request.url}`);
          token = url.searchParams.get("token") ?? "";
          next = url.searchParams.get("next") ?? "";
        } catch {
          return error({ message: "Invalid token." });
        }

        const link = request.cookies<AuthCookies>().get(LINK_COOKIE)?.value;

        console.log("LINK", link);

        if (!link) {
          return error({ message: "Invalid link" });
        }

        let serverToken: string;
        try {
          const url = new URL(link);
          serverToken = url.searchParams.get("token") ?? "";
        } catch {
          return error({ message: "Invalid device" });
        }

        console.log("* LINK", { token, serverToken });

        if (token !== serverToken) {
          return error({ message: "Invalid token" });
        }

        let email: string;
        let date: string;

        try {
          ({ email, date } = decode(token, { decrypt: true }) as LinkPayload);
        } catch (err: unknown) {
          return error({
            message: "Sign in link invalid. Please request a new one. [1]",
          });
        }

        if (typeof email !== "string") {
          return error({
            message: "Sign in link invalid. Please request a new one. [2]",
          });
        }

        if (typeof date !== "string") {
          return error({
            message: "Sign in link invalid. Please request a new one. [4]",
          });
        }

        const linkCreationDate = new Date(date);
        const expirationTime = linkCreationDate.getTime() + 10 * 60 * 1000;

        if (Date.now() > expirationTime) {
          return error({
            message: "Magic link expired. Please request a new one. [5]",
          });
        }

        await organizations.insertUser(email);

        response
          .cookies<AuthCookies>()
          .set(
            GLOBAL_SESSION_COOKIE,
            { email },
            { path: "/", sameSite: "lax", secure: true, httpOnly: true }
          );

        response.cookies<AuthCookies>().delete(LINK_COOKIE, {
          path: "/",
          sameSite: "lax",
          secure: true,
          httpOnly: true,
          encrypt: true,
        });

        response.redirect = `${domain}/${next ?? ""}?success=true`;

        return success(null);
      },
      redirect(result) {
        return isError(result) ? `${domain}/?success=false` : undefined;
      },
    }),

    addOrganization: createProcedure({
      middleware(ctx) {
        return ctx.use(cors, emailAuth);
      },
      schema() {
        return z.object({
          slug: z.string(),
          url: z.string().optional(),
        });
      },
      async mutation({ slug, url }, { request, email }) {
        try {
          if (url) {
            await organizations.addNewOrganizationToUser(email, { slug, url });
          } else {
            await organizations.addExistingOrganizationToUser(email, { slug });
          }
          return success(null);
        } catch (err) {
          console.log(slug, url, err);
          return error({ message: "Failed", detail: err });
        }
      },
    }),

    getOrganizations: createProcedure({
      middleware(ctx) {
        return ctx.use(cors, emailAuth);
      },
      async query(_, { request, response, email }) {
        const data = await organizations.getUserWithOrganizations(email);

        return success(data);
      },
    }),

    authenticate: createProcedure({
      middleware(ctx) {
        return ctx.use(cors);
      },
      schema() {
        return z.object({
          organization: z.object({
            slug: z.string().nullable(),
            url: z.string().nullable(),
          }),
          returnConfig: z.boolean(),
        });
      },
      async mutation({ organization, returnConfig }, { request, response }) {
        const cookies = {
          req: request.cookies<AuthCookies>(),
          res: response.cookies<AuthCookies>(),
        };

        const user = cookies.req.get(GLOBAL_SESSION_COOKIE)?.value;

        if (!user) {
          return error({ message: "Not authenticated", status: 401 });
        }

        try {
          const getData = async (url: string, key: string | undefined) => {
            const token = serializeAuthToken(
              { email: user.email },
              process.env.STORYFLOW_PRIVATE_KEY as string
            );

            const json = await fetch(`${url}/api/admin/authenticate`, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                query: { key: !key, config: returnConfig },
              }),
            }).then(
              (res) =>
                res.json() as Promise<
                  Result<{
                    token: string;
                    key?: string;
                    config?: {
                      apps: AppReference[];
                      workspaces: {
                        name: string;
                      }[];
                    };
                  }>
                >
            );

            if (isError(json)) {
              return;
            }

            const data = unwrap(json);

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

          return success({
            user: { email: user.email },
            config: data.config ?? null,
            url,
          });
        } catch (err) {
          return success({
            user: { email: user.email },
            config: null,
            url: null,
          });
        }
      },
    }),

    logout: createProcedure({
      middleware(ctx) {
        return ctx.use(cors);
      },
      async mutation(_, { response }) {
        response.cookies<AuthCookies>().delete(GLOBAL_SESSION_COOKIE, {
          path: "/",
          sameSite: "lax",
          secure: true,
          httpOnly: true,
        });
        response.cookies<AuthCookies>().delete(GLOBAL_TOKEN, {
          path: "/",
          sameSite: "strict",
          secure: true,
        });
        return success(null);
      },
    }),
  });
};
