import { NoList } from "@storyflow/dnd";
import React from "react";
import type { FieldId } from "@storyflow/shared/types";
import type { FieldConfig, FieldUI } from "@storyflow/fields-core/types";
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
  id,
  fieldConfig,
  index,
  version,
  dragHandleProps,
}: {
  id: FieldId;
  fieldConfig: FieldConfig;
  index: number;
  version: number;
  dragHandleProps?: any;
}) {
  const Component = Components[fieldConfig.ui ?? "default"];

  return (
    <FieldIdContext.Provider value={id}>
      <FieldRestrictionsContext.Provider value={fieldConfig.type2 ?? null}>
        <FieldContainer
          index={index}
          fieldConfig={fieldConfig}
          dragHandleProps={dragHandleProps}
        >
          <NoList>
            <Component
              {...{
                id,
                fieldConfig,
                version,
              }}
            />
          </NoList>
        </FieldContainer>
      </FieldRestrictionsContext.Provider>
    </FieldIdContext.Provider>
  );
}
