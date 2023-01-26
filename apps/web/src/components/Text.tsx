import { cms } from "@storyflow/react";

export const Text = {
  component: ({ text }: any) => {
    const level = (text.match(/^(\#+)\s/)?.[1] ?? "").length;
    if (level === 0) {
      return <cms.p>{text}</cms.p>;
    }

    const tag = `h${level}` as "h1";

    const className = {
      h1: "text-3xl mt-4",
      h2: "text-xl mt-2",
    }[tag];

    return (
      <cms.element as={tag} className={className}>
        {text.slice(level + 1)}
      </cms.element>
    );
  },
  props: [
    {
      type: "string",
      name: "text",
      label: "Tekst",
    },
  ],
};
