import { NoList } from "@storyflow/dnd";
import React from "react";
import { ComputationOp } from "shared/operations";
import { FieldConfig, FieldId, FieldType } from "@storyflow/backend/types";
import { DefaultFieldRoot } from "./default/DefaultFieldRoot";
import { FieldContainer } from "./FieldContainer";
import UrlField from "./UrlField";
import { ServerPackage } from "@storyflow/state";
import { FieldIdContext } from "./FieldIdContext";
import { FieldRestrictionsContext } from "./FieldIdContext";

const Components: { [K in FieldType]: React.FC<FieldProps> } = {
  default: DefaultFieldRoot,
  url: UrlField,
  slug: DefaultFieldRoot,
};

const getComponent = <T extends FieldType>(type: T): React.FC<FieldProps> => {
  return Components[type];
};

export type FieldProps = {
  id: FieldId;
  version: number;
  history: ServerPackage<ComputationOp>[];
};

export function RenderField<T extends FieldType>({
  id,
  fieldConfig,
  history,
  index,
  version,
  dragHandleProps,
}: {
  id: FieldId;
  fieldConfig: FieldConfig<T>;
  index: number;
  version: number;
  history: ServerPackage<ComputationOp>[];
  dragHandleProps?: any;
}) {
  const Component = getComponent(fieldConfig.type);

  return (
    <FieldIdContext.Provider value={id}>
      <FieldRestrictionsContext.Provider value={fieldConfig.restrictTo ?? null}>
        <FieldContainer
          index={index}
          fieldConfig={fieldConfig}
          dragHandleProps={dragHandleProps}
        >
          <NoList>
            <Component
              {...{
                id,
                version,
                fieldConfig,
                history,
              }}
            />
          </NoList>
        </FieldContainer>
      </FieldRestrictionsContext.Provider>
    </FieldIdContext.Provider>
  );
}
