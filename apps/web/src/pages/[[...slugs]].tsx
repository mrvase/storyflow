import {
  GetServerSideProps,
  GetServerSidePropsContext,
  GetStaticPropsContext,
} from "next";
import Link from "next/link";

export const getServerSideProps = async (ctx: GetServerSidePropsContext) => {
  const { slugs: _slugs } = ctx.params as any;

  const slugs = _slugs ?? [];

  if (slugs[0] !== "pricing" && slugs[0] !== undefined) {
    return {
      redirect: {
        destination: `/login?next=${slugs[0]}`,
      },
    };
  }
  return { props: {} };
};

/*
export const getStaticPaths = () => {
  return {
    paths: [],
    fallback: "blocking",
  };
};
*/

export default function Page() {
  return (
    <div>
      <Link href="/login">Log ind</Link>
    </div>
  );
}
