export const orgs =
  process.env.NODE_ENV === "development"
    ? [{ slug: "kfs", url: "localhost:3001" }]
    : undefined;
