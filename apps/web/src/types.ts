export type Organization = { slug: string; name: string } & (
  | { db: string; permissions: Record<string, any> | false }
  | {}
);

export type User = {
  email: string;
  name: string;
  organizations: Organization[];
};
