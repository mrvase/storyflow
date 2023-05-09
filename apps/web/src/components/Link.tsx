import { CMSElement, Config, PropConfigRecord, Props } from "@storyflow/react";
import NextLink from "next/link";

const label = "Link";

const props = {
  label: {
    type: "string",
    label: "Label",
    searchable: true,
  },
  href: {
    type: "string",
    label: "URL",
  },
} satisfies PropConfigRecord;

export const Link = ({ href, label }: Props<typeof props>) => {
  return (
    <CMSElement>
      <NextLink href={href || "/"} className="text-blue-500">
        {label}
      </NextLink>
    </CMSElement>
  );
};

export const LinkConfig = {
  label,
  props,
  inline: true,
  component: Link,
} satisfies Config<typeof props>;
