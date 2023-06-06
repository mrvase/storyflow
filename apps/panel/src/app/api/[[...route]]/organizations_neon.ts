import postgres from "postgres";
import { AuthOptions } from "services-api";

const sql = postgres(process.env.PGCONNECTION as string, { ssl: "require" });

export const organizations: AuthOptions["organizations"] = {
  async insertUser(email: string) {
    await sql`insert into users (email) values (${email}) on conflict do nothing;`;
  },
  async getOrganizationUrl(slug: string) {
    const result = await sql<
      { slug: string; url: string }[]
    >`SELECT url FROM organizations WHERE slug = ${slug};`;

    if (!result.length) return;

    return result[0].url;
  },
  async addNewOrganizationToUser(email, { slug, url }) {
    await sql`
WITH new_org AS (
    INSERT INTO organizations (slug, url) VALUES (${slug}, ${url})
    RETURNING id
)
UPDATE users SET organizations = array_append(organizations, (SELECT id FROM new_org)) WHERE email = ${email}
RETURNING (SELECT id FROM new_org);
`;
  },
  async addExistingOrganizationToUser(email, { slug }) {
    const result = await sql`
WITH new_org AS (
    SELECT id, slug FROM organizations WHERE slug = ${slug}
)
UPDATE users SET organizations = array_append(organizations, (SELECT id FROM new_org)) WHERE email = ${email}          
`;
  },
  async getUserWithOrganizations(email) {
    const result = await sql<{ slug: string | null; url: string | null }[]>`
SELECT u.*, o.*
FROM Users u
LEFT JOIN Organizations o ON o.id = ANY (u.organizations)
WHERE u.email = ${email};
`;

    const organizations = result
      .filter(
        (el): el is { slug: string; url: string } =>
          el.slug !== null && el.url !== null
      )
      .map(({ slug, url }) => ({ slug, url }));

    return { email, organizations };
  },
};
