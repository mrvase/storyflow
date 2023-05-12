import {
  Config,
  PropConfigRecord,
  Props,
  Stories,
  cms,
} from "@storyflow/react";

export const Content = ({ content, style }: Props<typeof props>) => {
  return (
    <cms.div className="p-20" style={style}>
      {content}
    </cms.div>
  );
};

const label = "Indhold";

const props = {
  content: {
    type: "children",
    label: "Indhold",
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
          { name: "theme1", label: "Temafarve 1", value: "#f0f" },
          { name: "theme2", label: "Temafarve 2", value: "#0f0" },
        ],
      },
    },
  },
} satisfies PropConfigRecord;

const stories = {
  "": {
    props: {
      style: {
        backgroundColor: "#f0f",
        color: "#0f0",
      },
      content: ["Prøver med en anden tekst"],
    },
  },
  "En anden farve": {
    props: {
      style: {
        backgroundColor: "#0f0",
      },
      content: ["hej med dig"],
    },
  },
} satisfies Stories<typeof props>;

export const ContentConfig = {
  label,
  props,
  stories,
  component: Content,
} satisfies Config<typeof props>;
