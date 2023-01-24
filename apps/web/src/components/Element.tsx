import { cms, ParseRichText } from "@storyflow/react";

export const Element = {
  component: ({ info, children }: any) => {
    return (
      <cms.div className="p-5">
        <div>
          <ParseRichText>{info}</ParseRichText>
        </div>
        <div>{children}</div>
      </cms.div>
    );
  },
  props: [
    {
      type: "string",
      name: "info",
      label: "Info",
    },
    {
      type: "children",
      name: "children",
      label: "Komponenter",
    },
  ],
};
