export const orgs =
  process.env.NODE_ENV === "development"
    ? [
        { slug: "kfs", url: "localhost:3001" },
        { slug: "semper", url: "localhost:3003" },
        { slug: "dashboard", url: "localhost:4000" },
      ]
    : undefined;
