import { createAPIRoute, migration } from "migration-api";

export default createAPIRoute(
  { migration },
  {
    secret: process.env.SECRET_KEY as string,
    route: "migration",
  }
);
