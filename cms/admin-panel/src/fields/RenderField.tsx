import { NoList } from "@storyflow/dnd";
import React from "react";
import type { FieldId } from "@storyflow/shared/types";
import type { FieldConfig, FieldUI } from "@storyflow/cms/types";
import { DefaultFieldRoot } from "./default/DefaultFieldRoot";
import { FieldContainer } from "./FieldContainer";
import UrlField from "./UrlField";
import { FieldIdContext } from "./FieldIdContext";
import { FieldRestrictionsContext } from "./FieldIdContext";
import type { FieldProps } from "./types";

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

  const Component = Components[fieldConfig.ui ?? "default"];

  return (
    <FieldIdContext.Provider value={fieldId}>
      <FieldRestrictionsContext.Provider value={fieldConfig.type2 ?? null}>
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
