import {
  Config,
  PropConfigRecord,
  Props,
  Stories,
  cms,
  createServerContext,
} from "@storyflow/react";

const ContentContext = createServerContext<{
  parentColor: string;
  test: string;
}>();

export const Content = ({
  content,
  style,
  useServerContext,
}: Props<typeof props>) => {
  const result = useServerContext(ContentContext);
  console.log("PARENT CONTEXT", style, result);

  return (
    <cms.div
      className="p-20"
      style={{
        ...style,
        border: result?.parentColor
          ? `1px ${result.parentColor} solid`
          : undefined,
      }}
    >
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
  provideContext: (props) => {
    return ContentContext({ parentColor: props.style.color, test: "hello" });
  },
  component: Content,
} satisfies Config<typeof props>;
