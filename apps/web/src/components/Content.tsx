import { cms } from "@storyflow/react";
import { createComponent } from "@storyflow/react/config";

export const Content = createComponent(
  ({ content, backgroundColor }) => {
    return (
      <cms.div className="p-20" style={{ backgroundColor }}>
        {content}
      </cms.div>
    );
  },
  {
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
    ] as const,
    stories: [
      {
        props: {
          backgroundColor: "#f0f",
          content: ["hej med dig"],
        },
      },
      {
        label: "En anden farve",
        props: {
          backgroundColor: "#00f",
          content: ["hej med dig"],
        },
      },
    ],
  }
);
