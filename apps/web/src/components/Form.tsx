import { cms, withComponent } from "@storyflow/react";
import { FormStatus } from "./FormStatus";

export const FormConfig = withComponent(
  ({ children, action }) => {
    return (
      <cms.div className="w-full">
        Status: <FormStatus action={action} />
        <cms.form
          action={action}
          /*
          uploadFile={async (file: File) => {
            const { name, url } = {
              name: "633bea103d9da929d79e9cfd-1-1-0-1308-e4d.png",
              url: "",
            }; // GET UPLOAD LINK

            return name;
          }}
          */
        >
          {children}
          <button type="submit">submit</button>
        </cms.form>
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

export const TextFieldConfig = withComponent(
  ({ input }) => {
    return (
      <div>
        {input.label}
        <cms.input type="text" name={input.name} className="bg-gray-100 p-3" />
      </div>
    );
  },
  {
    label: "Tekstfelt",
    props: {
      input: {
        label: "Input",
        type: "input",
      },
    },
  }
);

export const FileFieldConfig = withComponent(
  ({ input }) => {
    return (
      <div>
        {input.label}
        <cms.input type="file" name={input.name} className="bg-gray-100 p-3" />
      </div>
    );
  },
  {
    label: "Filfelt",
    props: {
      input: {
        label: "Input",
        type: "input",
      },
    },
  }
);
