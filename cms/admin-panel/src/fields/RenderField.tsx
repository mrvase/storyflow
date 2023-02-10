import { NoList } from "@storyflow/dnd";
import React from "react";
import { FieldOperation } from "shared/operations";
import {
  Computation,
  DocumentId,
  FieldConfig,
  FieldId,
  FieldType,
} from "@storyflow/backend/types";
import DefaultField from "./default/DefaultField";
import { FieldContainer } from "./FieldContainer";
import UrlField from "./UrlField";
import { ServerPackage } from "@storyflow/state";
import { FieldIdContext } from "./FieldIdContext";

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

export type FieldProps<T extends FieldType> = {
  id: FieldId;
  value: Computation;
  fieldConfig: FieldConfig<T>;
  version: number;
  history: ServerPackage<FieldOperation[T]>[];
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
  value: Computation;
  fieldConfig: FieldConfig<T>;
  index: number;
  version: number;
  history: ServerPackage<FieldOperation[T]>[];
  template: DocumentId;
  dragHandleProps?: any;
}) {
  const Component = getComponent(fieldConfig.type);

  return (
    <FieldIdContext.Provider value={id}>
      <FieldContainer
        index={index}
        fieldConfig={fieldConfig}
        dragHandleProps={dragHandleProps}
        template={template}
        initialValue={value}
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
    </FieldIdContext.Provider>
  );
}
