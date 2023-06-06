import { AuthOptions } from "services-api";
import { client } from "../../../mongo";

const orgs = [{ slug: "kfs", url: "localhost:3001" }];

export const organizations: AuthOptions["organizations"] = {
  async insertUser(email: string) {
    const db = await client.get();
    await db.collection("users").insertOne({ email });
  },
  async getOrganizationUrl(slug: string) {
    const db = await client.get();
    if (orgs) {
      return orgs.find((org) => org.slug === slug)?.url;
    }
    const result = await db
      .collection<{ slug: string; url: string }>("organizations")
      .findOne({ slug });
    return result?.url;
  },
  async addNewOrganizationToUser(email, { slug, url }) {
    const db = await client.get();
    const result = await db
      .collection<{ slug: string; url: string }>("organizations")
      .insertOne({ slug, url });

    const id = result.insertedId;

    await db
      .collection("users")
      .updateOne({ email }, { $push: { organizations: id } });
  },
  async addExistingOrganizationToUser(email, { slug }) {
    const db = await client.get();
    const result = await db
      .collection<{ slug: string; url: string }>("organizations")
      .findOne({ slug });

    if (!result) return;

    const id = result._id;

    await db
      .collection("users")
      .updateOne({ email }, { $push: { organizations: id } }, { upsert: true });
  },
  async getUserWithOrganizations(email) {
    const db = await client.get();
    const result = (await db
      .collection("users")
      .aggregate([
        { $match: { email } },
        {
          $lookup: {
            from: "organizations",
            localField: "organizations",
            foreignField: "_id",
            as: "organizations",
          },
        },
      ])
      .next()) as
      | {
          email: string;
          organizations: { slug: string; url: string }[];
        }
      | undefined;

    return result
      ? {
          ...result,
          organizations: orgs ?? result.organizations,
        }
      : undefined;
  },
};
