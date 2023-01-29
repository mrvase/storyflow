import { NoList } from "@storyflow/dnd";
import React from "react";
import { FieldOperation } from "shared/operations";
import {
  Computation,
  FieldConfig,
  FieldId,
  FieldType,
} from "@storyflow/backend/types";
import { useContextWithError } from "../utils/contextError";
import DefaultField from "./DefaultField";
import FieldContainer from "./FieldContainer";
import UrlField from "./UrlField";
import { ServerPackage } from "@storyflow/state";

const FieldIdContext = React.createContext<FieldId | null>(null);
export const useFieldId = () => useContextWithError(FieldIdContext, "FieldId");

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
  dragHandleProps,
}: {
  id: FieldId;
  value: Computation;
  fieldConfig: FieldConfig<T>;
  index: number;
  version: number;
  history: ServerPackage<FieldOperation[T]>[];
  dragHandleProps?: any;
}) {
  const Component = getComponent(fieldConfig.type);

  return (
    <FieldIdContext.Provider value={id}>
      <FieldContainer
        index={index}
        fieldConfig={fieldConfig}
        dragHandleProps={dragHandleProps}
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
