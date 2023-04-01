const apiKey = Buffer.from(process.env.API_KEY as string).toString("base64");

export const options = {
  namespaces: process.env.NAMESPACES?.split(",") ?? [],
  key: apiKey as string,
};
