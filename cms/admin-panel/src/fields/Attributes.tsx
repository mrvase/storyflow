import cl from "clsx";
import React from "react";
import {
  FieldConfig,
  FieldId,
  FieldType,
  NestedDocumentId,
  NestedEntity,
  ValueArray,
} from "@storyflow/backend/types";
import { useFieldId } from "./FieldIdContext";
import { getConfigFromType, useClientConfig } from "../client-config";
import {
  computeFieldId,
  createTemplateFieldId,
  getIdFromString,
} from "@storyflow/backend/ids";
import { useGlobalState } from "../state/state";
import { DEFAULT_SYNTAX_TREE } from "@storyflow/backend/constants";
import { useClient } from "../client";
import { useDocumentPageContext } from "../documents/DocumentPageContext";
import { calculateFn } from "./default/calculateFn";
import { useContextWithError } from "../utils/contextError";
import { useSelectedNestedEntity } from "./Path";
import { flattenProps } from "../utils/flattenProps";
import { useFieldTemplate } from "./default/useFieldTemplate";
import { Bars3Icon } from "@heroicons/react/24/outline";

const AttributesContext = React.createContext<
  [FieldId | null, React.Dispatch<FieldId | null>] | null
>(null);

export function useAttributesContext() {
  return useContextWithError(AttributesContext, "Attributes");
}

export function AttributesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const state = React.useState<FieldId | null>(null);

  return (
    <AttributesContext.Provider value={state}>
      {children}
    </AttributesContext.Provider>
  );
}

const noTemplate: FieldConfig<FieldType>[] = [];

export function Attributes({
  entity,
  hideChildrenProps,
  hideAsDefault,
}: {
  hideChildrenProps?: boolean;
  hideAsDefault?: boolean;
  entity?: NestedEntity;
}) {
  const [currentProp, setCurrentProp] = useAttributesContext();
  const { libraries } = useClientConfig();

  const fieldId = useFieldId();
  const template = useFieldTemplate(fieldId) ?? noTemplate;

  if (!entity) {
    // const [{ selectedDocument }] = useSelectedPath();
    entity = useSelectedNestedEntity();
  }

  let props: { id: FieldId; label: React.ReactNode }[] = React.useMemo(() => {
    if (entity && "element" in entity) {
      const config = getConfigFromType(entity.element, libraries);

      let result: { id: FieldId; label: React.ReactNode; type?: string }[] =
        flattenProps(entity!.id as NestedDocumentId, config?.props ?? []);
      if (hideChildrenProps) {
        result = result.filter((el) => el.type !== "children");
      }

      if (result.length) {
        result.push({
          id: computeFieldId(entity!.id, getIdFromString("key")),
          label: <Bars3Icon className="w-3 h-3" />,
        });
      }

      return result;
    }
    if (entity && "folder" in entity) {
      return template.map((el) => {
        return {
          id: createTemplateFieldId(entity!.id, el.id),
          label: el.label,
        };
      });
    }
    return [];
  }, [entity]);

  React.useLayoutEffect(() => {
    if (!hideAsDefault) {
      setCurrentProp(props[0]?.id ?? null);
    }
  }, [props, hideAsDefault]);

  if (!entity) {
    return null;
  }

  return (
    <div className="flex gap-2 cursor-default">
      {(props ?? []).map((el) => (
        <PropPreview
          key={el.id}
          prop={el}
          selected={currentProp === el.id}
          select={(toggle) => setCurrentProp(toggle ? el.id : null)}
        />
      ))}
    </div>
  );
}

function PropPreview({
  prop,
  selected,
  select,
}: {
  prop: { id: FieldId; label: React.ReactNode };
  selected: boolean;
  select: (value: boolean) => void;
}) {
  const rootId = useFieldId();
  const client = useClient();
  const { record } = useDocumentPageContext();
  const initialValue = record[prop.id] ?? DEFAULT_SYNTAX_TREE;

  const [output] = useGlobalState<ValueArray>(prop.id, () =>
    calculateFn(rootId, initialValue, { record, client })
  );

  const preview = ["number", "string"].includes(typeof output[0])
    ? (output[0] as string)
    : "";

  return (
    <div
      className={cl(
        "rounded-full flex items-center px-2 py-0.5 font-light text-xs transition-colors ring-inset ring-gray-750",
        selected
          ? "bg-gray-750 text-gray-400 ring-1"
          : "text-gray-700 hover:ring-1"
      )}
      onMouseDown={(ev) => {
        select(!selected);
        ev.stopPropagation();
      }}
    >
      <span className="font-normal whitespace-nowrap">
        {prop.label}
        {preview ? <>&nbsp;&nbsp;</> : ""}
      </span>
      <span
        className={cl(
          selected ? "text-gray-400" : "text-gray-500",
          "max-w-[80px] truncate"
        )}
      >
        {preview}
      </span>
    </div>
  );
}
