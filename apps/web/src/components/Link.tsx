import { CMSElement } from "@storyflow/react";
import NextLink from "next/link";

export const Link = {
  component: ({ href, label }: any) => {
    return (
      <CMSElement>
        <NextLink href={href ? `/${href}` : "/"} className="text-blue-500">
          {label}
        </NextLink>
      </CMSElement>
    );
  },
  label: "Link",
  props: [
    {
      type: "string",
      name: "href",
      label: "URL",
    },
    {
      type: "string",
      name: "label",
      label: "Label",
    },
  ],
  inline: true,
};
