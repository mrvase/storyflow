import cl from "clsx";
import React from "react";
import {
  FieldId,
  NestedDocumentId,
  ValueArray,
} from "@storyflow/backend/types";
import { PropConfig, RegularOptions } from "@storyflow/frontend/types";
import { useFieldId } from "./FieldIdContext";
import { useBuilderPath } from "./BuilderPath";
import { getConfigFromType, useClientConfig } from "../client-config";
import { computeFieldId, getIdFromString } from "@storyflow/backend/ids";
import { useGlobalState } from "../state/state";
import { extendPath } from "@storyflow/backend/extendPath";
import { DEFAULT_SYNTAX_TREE } from "@storyflow/backend/constants";
import { useClient } from "../client";
import { useDocumentPageContext } from "../documents/DocumentPageContext";
import { calculateFn } from "./default/calculateFn";
import { useContextWithError } from "../utils/contextError";

const AttributesContext = React.createContext<
  | [
      (PropConfig<RegularOptions> & { id: FieldId }) | null,
      React.Dispatch<(PropConfig<RegularOptions> & { id: FieldId }) | null>
    ]
  | null
>(null);

export function useAttributesContext() {
  return useContextWithError(AttributesContext, "Attributes");
}

export function AttributesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const state = React.useState<
    (PropConfig<RegularOptions> & { id: FieldId }) | null
  >(null);

  return (
    <AttributesContext.Provider value={state}>
      {children}
    </AttributesContext.Provider>
  );
}

export function Attributes(props: {
  hideChildrenProps?: boolean;
  hideAsDefault?: boolean;
  id?: NestedDocumentId;
  element?: string;
}) {
  const [currentProp, setCurrentProp] = useAttributesContext();
  const [path] = useBuilderPath();

  const id =
    props.id ?? (path[path.length - 1]?.id as NestedDocumentId | undefined);
  const element =
    props.element ??
    ((path[path.length - 1] as any)?.element as string | undefined);

  const { libraries } = useClientConfig();

  const config = element ? getConfigFromType(element, libraries) : undefined;

  const flatProps = React.useMemo(() => {
    if (!id) {
      return [];
    }
    let result = (config?.props ?? []).reduce(
      (acc: (PropConfig<RegularOptions> & { id: FieldId })[], el) =>
        el.type === "group"
          ? [
              ...acc,
              ...el.props.map((nested) => ({
                id: computeFieldId(
                  id,
                  getIdFromString(extendPath(el.name, nested.label, "#"))
                ),
                ...nested,
                label: `${el.name} (${nested.label})`,
              })),
            ]
          : [
              ...acc,
              {
                id: computeFieldId(id, getIdFromString(el.name)),
                ...(el as PropConfig<RegularOptions>),
              },
            ],
      []
    );
    if (props.hideChildrenProps) {
      result = result.filter((el) => el.type !== "children");
    }
    return result;
  }, [config?.props, id]);

  React.useLayoutEffect(() => {
    !props.hideAsDefault && setCurrentProp(flatProps[0] ?? null);
  }, [flatProps, props.hideAsDefault]);

  return (
    <div className="flex gap-2 cursor-default">
      {(flatProps ?? []).map((el) => (
        <PropPreview
          key={el.id}
          prop={el}
          selected={currentProp === el}
          select={(toggle) => setCurrentProp(toggle ? el : null)}
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
  prop: PropConfig<RegularOptions> & { id: FieldId };
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
        "rounded-full flex items-center border px-2 font-light text-xs transition-colors",
        selected
          ? "border-gray-600 text-gray-500"
          : "border-gray-750 text-gray-700 hover:border-gray-600 hover:text-gray-500"
      )}
      onMouseDown={(ev) => {
        select(!selected);
        ev.stopPropagation();
      }}
    >
      <span className="font-normal whitespace-nowrap">
        {prop.label}
        {preview ? <>:&nbsp;</> : ""}
      </span>
      <span className="text-gray-500 max-w-[80px] truncate">{preview}</span>
    </div>
  );
}
