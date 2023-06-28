import { cms, withComponent } from "@storyflow/react";
import { FormStatus } from "./FormStatus";

export const FormConfig = withComponent(
  ({ children, action }) => {
    return (
      <cms.div className="w-full">
        Status: <FormStatus action={action} />
        <cms.form action={action}>{children}</cms.form>
      </cms.div>
    );
  },
  {
    label: "Formular",
    props: {
      children: {
        type: "children",
        label: "Indhold",
      },
      action: {
        type: "action",
        label: "Handling",
      },
    },
  }
);
