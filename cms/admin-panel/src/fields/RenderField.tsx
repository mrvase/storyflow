import { NoList } from "@storyflow/dnd";
import React from "react";
import { ComputationOp } from "shared/operations";
import {
  DocumentId,
  FieldConfig,
  FieldId,
  FieldType,
  SyntaxTree,
} from "@storyflow/backend/types";
import DefaultField from "./default/DefaultField";
import { FieldContainer } from "./FieldContainer";
import UrlField from "./UrlField";
import { ServerPackage } from "@storyflow/state";
import { FieldIdContext } from "./FieldIdContext";
import { FieldRestrictionsContext } from "./FieldTypeContext";

const Components: { [K in FieldType]: React.FC<FieldProps<K>> } = {
  default: DefaultField,
  url: UrlField,
  slug: DefaultField,
};

const getComponent = <T extends FieldType>(
  type: T
): React.FC<FieldProps<T>> => {
  return Components[type];
};

export type FieldProps<T extends FieldType = FieldType> = {
  id: FieldId;
  value: SyntaxTree | undefined;
  fieldConfig: FieldConfig<T>;
  version: number;
  history: ServerPackage<ComputationOp>[];
};

export function RenderField<T extends FieldType>({
  id,
  value,
  fieldConfig,
  history,
  index,
  version,
  template,
  dragHandleProps,
}: {
  id: FieldId;
  value: SyntaxTree | undefined;
  fieldConfig: FieldConfig<T>;
  index: number;
  version: number;
  history: ServerPackage<ComputationOp>[];
  template: DocumentId;
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
          template={template}
        >
          <NoList>
            <Component
              {...{
                id,
                version,
                value,
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
