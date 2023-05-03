const crypto = require("node:crypto");
const fs = require("node:fs");

const trim = (key) => {
  return key.replace(/-----[^-]+-----/g, "").replace(/(\r\n|\n|\r)/gm, "");
};

crypto.generateKeyPair(
  "rsa",
  {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: "spki",
      format: "pem",
    },
    privateKeyEncoding: {
      type: "pkcs8",
      format: "pem",
      cipher: "aes-256-cbc",
      passphrase: "top secret",
    },
  },
  (err, publicKey, privateKey) => {
    console.log("\x1b[32mPublic Key:\n\x1b[0m");
    console.log(trim(publicKey));
    console.log(`\n\x1b[31mPrivate Key:\n\x1b[0m`);
    console.log(trim(privateKey));
    console.log("");
    try {
      const env = fs.readFileSync(".env.local").toString();
      const parse = (text) =>
        Object.fromEntries(
          text.split(/\r\n|\n|\r/gm).map((line) => line.split("="))
        );
      const unparse = (obj) =>
        Object.entries(obj)
          .map(([key, value]) => `${key}=${value}`)
          .join("\n");
      const parsed = parse(env);
      parsed.PRIVATE_KEY = trim(privateKey);
      parsed.PUBLIC_KEY = trim(publicKey);
      fs.writeFileSync(".env.local", unparse(parsed));
      console.log("Auto-updated .env.local\n");
    } catch (err) {
      console.log("Could not auto-update .env.local\n");
    }
  }
);
