import { createAPIRoute } from "migration-api";

export default createAPIRoute({
  secret: process.env.SECRET_KEY as string,
  route: ["migration"],
});
