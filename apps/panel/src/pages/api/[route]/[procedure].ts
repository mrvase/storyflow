import { createAPIRoute, auth, bucket, collab } from "services-api";

export default createAPIRoute(
  { auth, bucket, collab },
  { secret: process.env.SECRET_KEY as string }
);
