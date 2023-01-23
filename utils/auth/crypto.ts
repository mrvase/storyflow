export default {};
/*
import crypto from "crypto";

export interface Crypto {
  generateKey(secret: string): Promise<ArrayBuffer>;
  encrypt(key: ArrayBuffer, value: string): Promise<string>;
  decrypt(key: ArrayBuffer, value: string): Promise<string>;
}

function createCrypto(): Crypto {
  const algorithm = "aes-256-ctr";

  async function generateKey(secret: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      crypto.scrypt(secret, "salt", 32, (error, key) => {
        if (error) return reject(error);
        return resolve(key);
      });
    });
  }

  async function encrypt(key: Buffer, value: string): Promise<string> {
    let ivLength = 16;
    let iv = crypto.randomBytes(ivLength);

    let cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = Buffer.concat([cipher.update(value), cipher.final()]);
    return `${iv.toString("hex")}:${encrypted.toString("hex")}`;
  }

  async function decrypt(key: Buffer, value: string): Promise<string> {
    let [ivPart, encryptedPart] = value.split(":");
    if (!ivPart || !encryptedPart) {
      throw new Error("Invalid text.");
    }

    let iv = Buffer.from(ivPart, "hex");
    let encryptedText = Buffer.from(encryptedPart, "hex");
    let decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = Buffer.concat([
      decipher.update(encryptedText),
      decipher.final(),
    ]);
    return decrypted.toString();
  }

  return {
    generateKey,
    encrypt,
    decrypt,
  };
}

export default createCrypto();
*/
