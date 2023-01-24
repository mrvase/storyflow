import { cms } from "@storyflow/react";

export const Content = {
  component: ({ content, backgroundColor }: any) => {
    return (
      <cms.div className="p-20" style={{ backgroundColor }}>
        {content}
      </cms.div>
    );
  },
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
};
