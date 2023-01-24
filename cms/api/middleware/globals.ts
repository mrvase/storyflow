import { MiddlewareContext } from "@sfrpc/server";
import { error, isError, unwrap } from "@storyflow/result";
import { authorizer } from "../auth/auth";

import { cors as corsFactory } from "./cors";

export const cors = corsFactory(
  process.env.NODE_ENV === "production" ? [] : ["http://localhost:5173"]
);

const user = async ({ req, client }: MiddlewareContext) => {
  const userReponse = await authorizer.authorize(req);

  if (isError(userReponse)) {
    throw error({ message: "Not authorized.", status: 401 });
  }

  const user = unwrap(userReponse);
  const organization = user.organizations.find((el) => el.slug === client.slug);

  if (
    !organization ||
    !("db" in organization) ||
    !("permissions" in organization) ||
    organization.permissions === false
  ) {
    throw error({ message: "Not authorized.", status: 401 });
  }

  return {
    user,
    dbName: organization.db,
  };
};

export const globals = (ctx: MiddlewareContext) => {
  return ctx.use(cors, user);
};
