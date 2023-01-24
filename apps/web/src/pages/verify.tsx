import { unwrap } from "@storyflow/result";
import { GetServerSideProps } from "next";
import { User } from "../types";
import { api } from "api/auth";

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const token = ctx.query.token as string | undefined;
  const next = ctx.query.next as string | undefined;

  let user: User | null = null;

  if (token) {
    user = unwrap(
      await api.users.verifyLink.mutation.call(
        { context: { req: ctx.req, res: ctx.res } },
        token
      ),
      null
    );
    if (user && !next) {
      return {
        redirect: {
          destination: `/bruger`,
          permanent: false,
        },
      };
    }
  }
  if (next && (user || !token)) {
    if (!user) {
      user = unwrap(
        await api.users.getUser.query.call({
          context: { req: ctx.req, res: ctx.res },
        }),
        null
      );
    }

    if (user) {
      // check if there is access to next and then add cookie
      const updatedUser = unwrap(
        await api.users.verifyOrganization.query.call(
          {
            context: { req: ctx.req, res: ctx.res },
          },
          { slug: next, user }
        ),
        null
      );

      if (updatedUser) {
        return {
          redirect: {
            destination: `/${next}`,
            permanent: false,
          },
        };
      }
      return {
        redirect: {
          destination: `/bruger?unauthorized=${next}`,
          permanent: false,
        },
      };
    }
  }

  return {
    redirect: {
      destination: "/login",
      permanent: false,
    },
  };
};

export default function Verify() {
  return null;
}
