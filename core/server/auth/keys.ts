export const parseKey = (key: string, type: "public" | "private") => {
  return (
    `-----BEGIN ${
      type === "public" ? "PUBLIC" : "ENCRYPTED PRIVATE"
    } KEY-----\n` +
    key.match(/.{1,64}/g)!.join("\n") +
    `\n-----END ${type === "public" ? "PUBLIC" : "ENCRYPTED PRIVATE"} KEY-----`
  );
};
