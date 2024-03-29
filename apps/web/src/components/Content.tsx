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
  date,
  input,
  useServerContext,
}: Props<typeof props>) => {
  const result = useServerContext!(ContentContext);

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
      {input.label}
      <cms.input type="file" name={input.name} className="bg-gray-100 p-3" />
      {Intl.DateTimeFormat("da-DK", {
        dateStyle: "long",
        ...([date.getHours(), date.getMinutes(), date.getSeconds()].some(
          Boolean
        )
          ? { timeStyle: "short" }
          : {}),
      }).format(date)}
      {content}
      <button type="submit">Submit</button>
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
          { alias: "theme1", label: "Temafarve 1", value: "#f0f" },
          { alias: "theme2", label: "Temafarve 2", value: "#0f0" },
        ],
      },
    },
  },
  input: {
    label: "Input",
    type: "input",
  },
  date: {
    type: "date",
    label: "Dato",
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
