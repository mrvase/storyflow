import { createHeadTags, Metadata } from "@storyflow/frontend/head";

export function RenderHead({
  data,
  transformTitle,
}: {
  data?: Metadata;
  transformTitle?: (title: string) => string;
}) {
  const title =
    transformTitle && data?.title !== undefined
      ? transformTitle(data.title)
      : data?.title;

  const tags = createHeadTags({ ...data, title });

  return (
    <>
      {data ? tags.map(([SEOTag, SEOProps]) => <SEOTag {...SEOProps} />) : null}
    </>
  );
}
