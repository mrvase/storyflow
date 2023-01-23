import { GetServerSideProps } from "next";
import { api } from "../server/users";

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  await api.users.logout.mutation.call({
    context: { req: ctx.req, res: ctx.res },
  });
  return {
    redirect: {
      destination: "/",
      permanent: false,
    },
  };
};

export default function Verify() {
  return null;
}
