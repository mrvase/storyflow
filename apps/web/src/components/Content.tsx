import { cms } from "@storyflow/react";
import { createComponent } from "@storyflow/react/config";

export const Content = createComponent(
  ({ content, style }) => {
    return (
      <cms.div className="p-20" style={style}>
        {content}
      </cms.div>
    );
  },
  {
    label: "Indhold",
    props: [
      {
        type: "children",
        name: "content",
        label: "Indhold",
      },
      {
        type: "group",
        name: "style",
        label: "Styling",
        props: [
          {
            type: "string",
            name: "backgroundColor",
            label: "Baggrundsfarve",
          },
        ],
      },
    ] as const,
    stories: [
      {
        props: {
          style: {
            backgroundColor: "#f0f",
          },
          content: ["hej med dig"],
        },
      },
      {
        label: "En anden farve",
        props: {
          style: {
            backgroundColor: "#f0f",
          },
          content: ["hej med dig"],
        },
      },
    ],
  }
);
