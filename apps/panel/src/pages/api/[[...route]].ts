import { createAPIRoute, auth, bucket, collab } from "services-api";
import { createTransport } from "nodemailer";
import postgres from "postgres";

const sql = postgres(process.env.PGCONNECTION as string, { ssl: "require" });

const options = {
  server: {
    host: process.env.EMAIL_SERVER_HOST as string,
    port: parseInt(process.env.EMAIL_SERVER_PORT ?? "587", 10),
    auth: {
      user: process.env.EMAIL_SERVER_USER as string,
      pass: process.env.EMAIL_SERVER_PASS as string,
    },
  },
  from: process.env.EMAIL_FROM as string,
};

export default createAPIRoute(
  {
    auth: auth({
      async sendEmail(link, payload) {
        const transport = createTransport(options.server);

        let text = `Log ind med linket: ${link}`;

        if (payload.invite) {
          text = `Du er blevet inviteret til at få adgang til storyflow.dk/${payload.invite}. Log ind med linket: ${link}`;
        }

        if (payload.register) {
          text = `Bekræft din email med linket: ${link}`;
        }

        try {
          const result = await transport.sendMail({
            to: payload.email,
            from: options.from,
            subject: "Log ind på Storyflow",
            text,
          });
          const failed = result.rejected.concat(result.pending).filter(Boolean);
          if (failed.length) {
            throw "Det lykkedes ikke at sende besked.";
          }
        } catch (err) {
          console.error(err);
          throw "Ukendt fejl";
        }
      },
      organizations: {
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
          const result = await sql<
            { slug: string | null; url: string | null }[]
          >`
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
      },
    }),
    bucket,
    collab,
  },
  { secret: process.env.SECRET_KEY as string }
);
