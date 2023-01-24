import { RenderPage } from "@storyflow/react";
import { fetchPage } from "@storyflow/server";
import { GetStaticProps } from "next";

export const getStaticProps: GetStaticProps = async (ctx) => {
  const slugs = ctx.params?.slugs;

  const url = Array.isArray(slugs) ? slugs.join("/") : "";

  if (url.indexOf(".") >= 0) {
    return { props: {} };
  }

  const data = await fetchPage(url);

  /*
  const redirect = data.find((el) => el?.redirect !== null);

  if (redirect) {
    return {
      redirect: {
        destination: `/${redirect.redirect}`,
        permanent: false,
      },
    };
  }
  */

  return {
    props: {
      data,
    },
  };
};

export const getStaticPaths = () => {
  return {
    paths: [],
    fallback: "blocking",
  };
};

export default function Component({ data }: { data: any }) {
  return <RenderPage data={data} />;
}
