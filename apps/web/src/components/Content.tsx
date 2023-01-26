import { cms } from "@storyflow/react";
import { Component, ComponentConfig } from "@storyflow/react/config";

export const ContentType = {
  name: "sf/content",
  label: "Indhold",
  props: [
    {
      type: "string",
      name: "backgroundColor",
      label: "Baggrundsfarve",
    },
    {
      type: "children",
      name: "content",
      label: "Indhold",
    },
  ],
  isDefault: true,
} as const satisfies ComponentConfig;

export const Content = (({ content, backgroundColor }) => {
  return (
    <cms.div className="p-20" style={{ backgroundColor }}>
      {content}
    </cms.div>
  );
}) satisfies Component<typeof ContentType>;
