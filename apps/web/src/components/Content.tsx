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
            options: ["#f0f", "#0f0"],
          },
          {
            type: "string",
            name: "color",
            label: "Tekstfarve",
            options: [
              { name: "theme1", label: "Temafarve 1", value: "#f0f" },
              { name: "theme2", label: "Temafarve 2", value: "#0f0" },
            ],
          },
        ],
      },
    ] as const,
    stories: [
      {
        props: {
          style: {
            backgroundColor: "#f0f",
            color: "#0f0",
          },
          content: ["hej med dig"],
        },
      },
      {
        label: "En anden farve",
        props: {
          style: {
            backgroundColor: "#0f0",
          },
          content: ["hej med dig"],
        },
      },
    ],
  }
);
