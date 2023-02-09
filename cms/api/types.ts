export type Organization = { slug: string } & (
  | { db: string; version: number; permissions: Record<string, any> | false }
  | { db?: never; version?: never; permissions?: never }
);

export type User = {
  email: string;
  name: string;
  organizations: Organization[];
};
