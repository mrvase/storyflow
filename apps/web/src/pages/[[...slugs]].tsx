import { GetStaticProps } from "next";
import Link from "next/link";

export const getStaticProps: GetStaticProps = async (ctx) => {
  const { slugs: _slugs } = ctx.params as any;

  const slugs = _slugs ?? [];

  if (slugs[0] !== "priser" && slugs[0] !== undefined) {
    return {
      notFound: true,
    };
  }
  return { props: {} };
};

export const getStaticPaths = () => {
  return {
    paths: [],
    fallback: "blocking",
  };
};

export default function Page() {
  return (
    <div>
      <Link href="/login">Log ind</Link>
    </div>
  );
}
