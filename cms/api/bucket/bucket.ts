import { error, isError, success } from "@storyflow/result";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createProcedure, createRoute } from "@sfrpc/server";
import { createId, restoreId } from "@storyflow/backend/ids";
import clientPromise from "../mongo/mongoClient";
import { globals } from "../middleware/globals";
import { z } from "zod";

const settingNumber = {
  private: 0,
  public: 1,
};

const typeNumber = {
  image: 1,
  video: 2,
  text: 3,
  application: 4,
};

const createFileName = ({
  type,
  extension,
  metadata,
  access,
}: {
  type: string;
  extension: string;
  metadata: {
    width?: number;
    height?: number;
    size?: number;
  };
  access: keyof typeof settingNumber;
}) => {
  const version = 0;

  const hex = (number: number) => number.toString(16);

  let name = restoreId(createId(2));
  name += `-${hex(settingNumber[access])}`;
  name += `-${hex(
    typeNumber[type.split("/")[0] as keyof typeof typeNumber] ?? 0
  )}`;
  name += `-${hex(version)}`;

  if (type.startsWith("image") || type.startsWith("video")) {
    name += `-${hex(metadata.width ?? 0)}-${hex(metadata.height ?? 0)}`;
  } else {
    name += `-${hex(metadata.size ?? 0)}`;
  }

  name += extension;

  return name;
};

export const bucket = createRoute({
  getUploadLink: createProcedure({
    middleware(ctx) {
      return ctx.use(globals);
    },
    schema() {
      return z.object({
        type: z.string(),
        label: z.string(),
        size: z.number(),
        extension: z.string(),
        metadata: z
          .object({
            width: z.number().optional(),
            height: z.number().optional(),
            size: z.number().optional(),
          })
          .optional(),
        access: z.union([z.literal("private"), z.literal("public")]).optional(),
      });
    },
    async query(
      { type, label, size, extension, metadata = {}, access = "public" },
      { dbName, slug }
    ) {
      const db = (await clientPromise).db(dbName);

      const name = createFileName({
        type,
        extension,
        metadata,
        access,
      });

      const dbFile = await db.collection("files").insertOne({ name, label });

      if (!dbFile.acknowledged) {
        return error({ message: "Failed to save file." });
      }

      const client = new S3Client({
        credentials: {
          accessKeyId: process.env.S3_ACCESS_KEY ?? "",
          secretAccessKey: process.env.S3_SECRET_KEY ?? "",
        },
        region: process.env.S3_REGION,
      });

      try {
        const command = new PutObjectCommand({
          Bucket: process.env.S3_BUCKET_NAME,
          Key: `${slug}/${name}`,
          ContentLength: size,
          ContentType: type,
          ...(access === "public" && { Tagging: "public=true" }),
        });

        const url = await getSignedUrl(client, command, {
          expiresIn: 60,
          unhoistableHeaders: new Set(["x-amz-tagging"]),
        });

        return success({
          name,
          url,
          headers:
            access === "public"
              ? {
                  "x-amz-tagging": "public=true",
                }
              : ({} as Record<string, string>),
        });
      } catch (err) {
        console.error(err);
        return error({ message: "Failed getting upload link.", detail: err });
      }
    },
  }),
});
