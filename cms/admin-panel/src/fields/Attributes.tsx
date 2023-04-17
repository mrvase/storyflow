import cl from "clsx";
import React from "react";
import {
  FieldConfig,
  FieldId,
  NestedDocumentId,
  NestedEntity,
  ValueArray,
} from "@storyflow/backend/types";
import { useFieldId } from "./FieldIdContext";
import { getConfigFromType, useClientConfig } from "../client-config";
import { createTemplateFieldId, getDocumentId } from "@storyflow/backend/ids";
import { useGlobalState } from "../state/state";
import { DEFAULT_SYNTAX_TREE } from "@storyflow/backend/constants";
import { useClient } from "../client";
import { useDocumentPageContext } from "../documents/DocumentPageContext";
import { calculateFn } from "./default/calculateFn";
import { useContextWithError } from "../utils/contextError";
import { useSelectedNestedEntity } from "./Path";
import { flattenProps } from "../utils/flattenProps";
import { useFieldTemplate } from "./default/useFieldTemplate";
import { getPreview } from "./default/getPreview";

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

const noTemplate: FieldConfig[] = [];

export function Attributes({
  entity,
  hideChildrenProps,
  hideAsDefault,
  color,
}: {
  hideChildrenProps?: boolean;
  hideAsDefault?: boolean;
  entity?: NestedEntity;
  color?: "gray" | "red" | "pink" | "yellow";
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

      /*
      if (result.length) {
        result.push({
          id: computeFieldId(entity!.id, getIdFromString("key")),
          label: <Bars3Icon className="w-3 h-3" />,
        });
      }
      */

      return result;
    }
    if (entity && "folder" in entity) {
      const props = template.map((el) => {
        return {
          id: createTemplateFieldId(entity!.id, el.id),
          label: el.label,
        };
      });
      console.log("HERE", entity, props);
      return props;
    }
    return [];
  }, [entity, template]);

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
          color={color}
        />
      ))}
    </div>
  );
}

function PropPreview({
  prop,
  selected,
  select,
  color = "gray",
}: {
  prop: { id: FieldId; label: React.ReactNode };
  selected: boolean;
  select: (value: boolean) => void;
  color?: "gray" | "red" | "pink" | "yellow";
}) {
  const rootId = useFieldId();
  const client = useClient();
  const { record } = useDocumentPageContext();
  const initialValue = record[prop.id] ?? DEFAULT_SYNTAX_TREE;

  const [output] = useGlobalState(prop.id, () =>
    calculateFn(initialValue, {
      record,
      client,
      documentId: getDocumentId(rootId),
    })
  );

  const preview = getPreview(output);

  const colors = {
    gray: {
      400: "text-gray-400",
      500: "text-gray-500",
      600: "text-gray-600",
      bg: "bg-gray-750",
      ring: "ring-gray-750",
    },
    pink: {
      400: "text-pink-100",
      500: "text-pink-200",
      600: "text-pink-300",
      bg: "bg-pink-700",
      ring: "ring-pink-700",
    },
    red: {
      400: "text-red-200/80",
      500: "text-red-200/60",
      600: "text-red-200/40",
      bg: "bg-red-200/10",
      ring: "ring-red-200/20",
    },
    yellow: {
      400: "text-yellow-200/80",
      500: "text-yellow-200/60",
      600: "text-yellow-200/40",
      bg: "bg-yellow-200/10",
      ring: "ring-yellow-200/20",
    },
  }[color ?? "gray"];

  return (
    <div
      className={cl(
        "rounded-full flex items-center px-2 py-0.5 text-xs transition-colors ring-inset",
        colors.ring,
        selected
          ? cl(colors[400], colors.bg, "ring-1")
          : cl(colors[500], "hover:ring-1")
      )}
      onMouseDown={(ev) => {
        select(!selected);
        ev.stopPropagation();
      }}
    >
      <span className="whitespace-nowrap font-bold">
        {prop.label}
        {preview ? <>&nbsp;&nbsp;</> : ""}
      </span>
      <span
        className={cl(
          selected ? colors[500] : colors[600],
          "max-w-[80px] font-medium truncate"
        )}
      >
        {preview}
      </span>
    </div>
  );
}
