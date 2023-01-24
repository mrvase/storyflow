export const cookieOptions = {
  name: "__session",
  httpOnly: process.env.NODE_ENV === "production",
  path: "/",
  sameSite: process.env.NODE_ENV === "production" ? ("lax" as "lax") : false,
  secrets: [process.env.SECRET_KEY as string],
  secure: process.env.NODE_ENV === "production",
};
