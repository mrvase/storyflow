import { createAPIRoute, auth, bucket, collab, migration } from "services-api";

export default createAPIRoute(
  { auth, bucket, collab, migration },
  { secret: process.env.SECRET_KEY as string }
);
