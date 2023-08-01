import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl as getSignedUrlAWS } from "@aws-sdk/s3-request-presigner";
import { globals, httpOnly } from "../middleware";
import { z } from "zod";
import { procedure, cors as corsFactory } from "@storyflow/server/rpc";
import { RPCError, isError } from "@nanorpc/server";

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

  let name = Math.random().toString(16).slice(2, 14);
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

const schema = z.object({
  type: z.string(),
  size: z.number(),
  name: z.string(),
  metadata: z
    .object({
      width: z.number().optional(),
      height: z.number().optional(),
      size: z.number().optional(),
    })
    .optional(),
  access: z.union([z.literal("private"), z.literal("public")]).optional(),
});

const getExtension = (name: string) => name.replace(/.*(\.[^.]+)$/, "$1");

const getSignedUrl = async ({
  type,
  size,
  name,
  slug,
  access,
}: {
  type: string;
  size: number;
  name: string;
  slug: string;
  access: keyof typeof settingNumber;
}) => {
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.S3_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY ?? "",
      secretAccessKey: process.env.S3_SECRET_KEY ?? "",
    },
  });

  try {
    const command = new PutObjectCommand({
      Bucket:
        access === "private"
          ? process.env.S3_BUCKET_NAME_PRIVATE
          : process.env.S3_BUCKET_NAME,
      Key: `${slug}/${name}`,
      ContentLength: size,
      ContentType: type,
    });

    const url = await getSignedUrlAWS(client, command, {
      expiresIn: 60,
    });

    return {
      name,
      url,
      headers: {},
    };
  } catch (err) {
    console.error(err);
    return new RPCError({
      code: "SERVER_ERROR",
      message: "Failed getting upload link.",
    });
  }
};

export const bucket = ({
  organizations,
}: {
  organizations?: {
    getOrganizationUrl: (slug: string) => Promise<string | undefined>;
  };
} = {}) => ({
  file: {
    "[name]": procedure
      .use(globals)
      .use(httpOnly)
      .query(async (_, { params, slug, res }) => {
        const client = new S3Client({
          region: "auto",
          endpoint: `https://${process.env.S3_ACCOUNT_ID}.r2.cloudflarestorage.com`,
          credentials: {
            accessKeyId: process.env.S3_ACCESS_KEY ?? "",
            secretAccessKey: process.env.S3_SECRET_KEY ?? "",
          },
        });

        try {
          const data = await client.send(
            new GetObjectCommand({
              Bucket: process.env.S3_BUCKET_NAME_PRIVATE as string,
              Key: `${slug}/${params.name}`,
            })
          );

          if (!data.Body) {
            return new RPCError({
              code: "NOT_FOUND",
              status: 404,
              message: "File not found.",
            });
          }

          /*
          res.headers.set("Content-Type", data.ContentType ?? "");
          res.headers.set(
            "Content-Length",
            data.ContentLength?.toString() ?? ""
          );
          */

          return data.Body.transformToWebStream();
        } catch (err) {
          if (
            err &&
            typeof err === "object" &&
            "Code" in err &&
            err.Code === "NoSuchKey"
          ) {
            return new RPCError({
              code: "NOT_FOUND",
              status: 404,
              message: "File not found.",
            });
          }
          console.error(err);
          return new RPCError({
            code: "SERVER_ERROR",
            message: "Failed getting file.",
          });
        }
      }),
  },

  getUploadLink: procedure
    .use(globals)
    .schema(schema)
    .query(
      async (
        { type, size, name: originalName, metadata = {}, access = "public" },
        { slug }
      ) => {
        const extension = getExtension(originalName ?? "");

        const name = createFileName({
          type,
          extension,
          metadata,
          access,
        });

        return getSignedUrl({
          type,
          size,
          name,
          slug,
          access,
        });
      }
    ),

  getUploadLinkForForm: procedure
    .schema(schema.extend({ slug: z.string() }))
    .use(corsFactory("allow-all"))
    .middleware(async (input, ctx, next) => {
      const url = await organizations?.getOrganizationUrl(input.slug);

      if (!url) {
        return new RPCError({ code: "UNAUTHORIZED" });
      }

      try {
        const protocol = url.startsWith("localhost") ? "http://" : "https://";
        const data = await fetch(`${protocol}${url}/api/admin/allowUploads`, {
          method: "GET",
        }).then((res) => {
          return res.json() as Promise<boolean>;
        });

        if (isError(data)) {
          console.error("auth error: from remote server:", data.error);
          throw "";
        }

        if (data !== true) {
          console.error(
            "auth error: invalid response from remote server [1]",
            data
          );
          throw "";
        }
      } catch (err) {
        console.error(err);
        return new RPCError({ code: "UNAUTHORIZED" });
      }

      return await next(input, ctx);
    })
    .query(
      ({
        name: originalName,
        type,
        size,
        slug,
        metadata = {},
        access = "public",
      }) => {
        const extension = getExtension(originalName ?? "");

        const name = createFileName({
          type,
          extension,
          metadata,
          access,
        });

        return getSignedUrl({
          type,
          size,
          name,
          slug,
          access,
        });
      }
    ),
});
