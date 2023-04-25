import { NoList } from "@storyflow/dnd";
import React from "react";
import { FieldId } from "@storyflow/shared/types";
import { FieldConfig, FieldUI } from "@storyflow/fields-core/types";
import { DefaultFieldRoot } from "./default/DefaultFieldRoot";
import { FieldContainer } from "./FieldContainer";
import UrlField from "./UrlField";
import { ServerPackage } from "@storyflow/state";
import { FieldIdContext } from "./FieldIdContext";
import { FieldRestrictionsContext } from "./FieldIdContext";
import { FieldOperation } from "operations/actions";
import { FieldProps } from "./types";

const Components: { [K in FieldUI | "default"]: React.FC<FieldProps> } = {
  default: DefaultFieldRoot,
  url: UrlField,
};

export function RenderField({
  id,
  fieldConfig,
  history,
  index,
  version,
  dragHandleProps,
}: {
  id: FieldId;
  fieldConfig: FieldConfig;
  index: number;
  version: number;
  history: ServerPackage<FieldOperation>[];
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
                history,
              }}
            />
          </NoList>
        </FieldContainer>
      </FieldRestrictionsContext.Provider>
    </FieldIdContext.Provider>
  );
}
