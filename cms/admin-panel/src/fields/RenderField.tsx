import { NoList } from "@storyflow/dnd";
import React from "react";
import type { FieldId } from "@storyflow/shared/types";
import type { FieldConfig, FieldUI } from "@storyflow/cms/types";
import { DefaultFieldRoot } from "./default/DefaultField";
import { FieldContainer } from "./FieldContainer";
import UrlField from "./UrlField";
import { FieldIdContext } from "./FieldIdContext";
import { FieldRestrictionsContext } from "./FieldIdContext";
import type { FieldProps } from "./types";
import { useIsCustomFolder } from "../folders/FolderPageContext";
import { ReadOnlyField } from "./ReadOnlyField";

const Components: { [K in FieldUI | "default"]: React.FC<FieldProps> } = {
  default: DefaultFieldRoot,
  url: UrlField,
};

export function RenderField({
  fieldId,
  fieldConfig: fieldConfigFromProps,
  index,
  dragHandleProps,
}: {
  fieldId: FieldId;
  fieldConfig: FieldConfig;
  index: number;
  dragHandleProps?: any;
}) {
  const fieldConfig = React.useMemo(
    () => ({
      ...fieldConfigFromProps,
      id: fieldId,
    }),
    [fieldId, fieldConfigFromProps]
  );

  let Component = Components[fieldConfig.ui ?? "default"];

  const isCustom = useIsCustomFolder();
  if (isCustom) {
    Component = ReadOnlyField;
  }

  return (
    <FieldIdContext.Provider value={fieldId}>
      <FieldRestrictionsContext.Provider value={fieldConfig.type ?? null}>
        <FieldContainer
          fieldConfig={fieldConfig}
          index={index}
          dragHandleProps={dragHandleProps}
        >
          <NoList>
            <Component id={fieldId} />
          </NoList>
        </FieldContainer>
      </FieldRestrictionsContext.Provider>
    </FieldIdContext.Provider>
  );
}
