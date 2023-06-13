import { Config, PropConfigRecord, Props, Stories } from "@storyflow/react";

export const OpenGraph = ({ content, style }: Props<typeof props>) => {
  return (
    <div
      tw="flex justify-center items-center w-full h-screen text-5xl"
      style={style}
    >
      {content}
    </div>
  );
};

const label = "Open Graph";

const props = {
  content: {
    type: "string",
    label: "Overskrift",
  },
  style: {
    type: "group",
    label: "Styling",
    props: {
      backgroundColor: {
        type: "color",
        label: "Baggrundsfarve",
        options: ["#f0f", "#0f0"],
      },
      color: {
        type: "color",
        label: "Tekstfarve",
        options: [
          { alias: "theme1", label: "Temafarve 1", value: "#f0f" },
          { alias: "theme2", label: "Temafarve 2", value: "#0f0" },
        ],
      },
    },
  },
} satisfies PropConfigRecord;

const stories = {} satisfies Stories<typeof props>;

export const OpenGraphConfig = {
  label,
  props,
  stories,
  component: OpenGraph,
} satisfies Config<typeof props>;
