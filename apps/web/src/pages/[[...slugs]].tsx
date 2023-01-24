import { RenderPage } from "@storyflow/react";
import { fetchPage } from "@storyflow/server";
import { GetServerSideProps } from "next";

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const { slug } = ctx.query;

  const url = Array.isArray(slug) ? slug.join("/") : "";

  if (url.indexOf(".") >= 0) {
    return { props: {} };
  }

  const data = await fetchPage(url);

  const redirect = data.find((el) => el?.redirect !== null);

  if (redirect) {
    return {
      redirect: {
        destination: `/${redirect.redirect}`,
        permanent: false,
      },
    };
  }

  return {
    props: {
      data,
    },
  };
};

export default function Component({ data }: { data: any }) {
  return <RenderPage data={data} />;
}
