import cl from "clsx";
import React from "react";
import {
  FieldId,
  NestedDocumentId,
  NestedEntity,
} from "@storyflow/shared/types";
import type { FieldConfig } from "@storyflow/cms/types";
import { useFieldId } from "./FieldIdContext";
import { getConfigFromType, useAppConfig } from "../AppConfigContext";
import { createTemplateFieldId, getDocumentId } from "@storyflow/cms/ids";
import { useGlobalState } from "../state/state";
import { DEFAULT_SYNTAX_TREE } from "@storyflow/cms/constants";
import { useDocumentPageContext } from "../documents/DocumentPageContext";
import { calculateFn } from "./default/calculateFn";
import { useContextWithError } from "../utils/contextError";
import { useSelectedNestedEntity } from "./Path";
import { flattenPropsWithIds } from "../utils/flattenProps";
import { useTemplate } from "./default/useFieldTemplate";
import { getPreview } from "./default/getPreview";
import { useFieldTemplateId } from "./default/FieldTemplateContext";

const AttributesContext = React.createContext<
  [FieldId | null, React.Dispatch<FieldId | null>] | null
>(null);

export function useAttributesContext() {
  return useContextWithError(AttributesContext, "Attributes");
}

export function AttributesProvider({
  children,
  defaultId,
}: {
  children: React.ReactNode;
  defaultId?: FieldId;
}) {
  const state = React.useState<FieldId | null>(defaultId ?? null);

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
  const { configs } = useAppConfig();

  let templateId = useFieldTemplateId();
  const template = useTemplate(templateId) ?? noTemplate;

  if (!entity) {
    // const [{ selectedDocument }] = useSelectedPath();
    entity = useSelectedNestedEntity();
  }

  let props: { id: FieldId; label: React.ReactNode }[] = React.useMemo(() => {
    if (entity && "element" in entity) {
      const config = getConfigFromType(entity.element, configs);

      let result: { id: FieldId; label: React.ReactNode; type?: string }[] =
        flattenPropsWithIds(
          entity!.id as NestedDocumentId,
          config?.props ?? {}
        );
      if (hideChildrenProps) {
        result = result.filter((el) => el.type !== "children");
      }

      return result;
    }
    if (entity && "folder" in entity) {
      const props = template.map((el) => {
        return {
          id: createTemplateFieldId(entity!.id, el.id),
          label: el.label,
        };
      });
      return props;
    }
    return [];
  }, [entity, template, configs]);

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
  const { record } = useDocumentPageContext();
  const initialValue = record[prop.id] ?? DEFAULT_SYNTAX_TREE;

  const [output] = useGlobalState(prop.id, () =>
    calculateFn(initialValue, {
      record,
      documentId: getDocumentId(rootId),
    })
  );

  const preview = getPreview(output);

  const colors = {
    gray: {
      textA400: "text-gray-400",
      textA500: "text-gray-500",
      textB500: "text-gray-500",
      textB600: "text-gray-600",
      bg: "bg-gray-750",
      ring: "ring-gray-750",
    },
    pink: {
      textA400: "text-pink-100",
      textA500: "text-pink-200",
      textB500: "text-pink-200",
      textB600: "text-pink-300",
      bg: "bg-pink-700",
      ring: "ring-pink-700",
    },
    red: {
      textA400: "text-red-200/80",
      textA500: "text-red-300/60",
      textB500: "text-red-200/80",
      textB600: "text-red-300/40",
      bg: "bg-red-400/20",
      ring: "ring-red-400/30",
    },
    yellow: {
      textA400: "text-yellow-100/80",
      textA500: "text-yellow-200/50",
      textB500: "text-yellow-100/80",
      textB600: "text-yellow-200/40",
      bg: "bg-yellow-300/10",
      ring: "ring-yellow-300/30",
    },
  }[color ?? "gray"];

  return (
    <div
      className={cl(
        "rounded-full flex items-center px-2 py-0.5 text-xs transition-colors ring-inset",
        colors.ring,
        selected ? cl(colors.bg, "ring-0") : cl("hover:ring-1")
      )}
      onMouseDown={(ev) => {
        select(!selected);
        ev.stopPropagation();
      }}
    >
      <span
        className={cl(
          "whitespace-nowrap font-semibold",
          selected ? cl(colors["textA400"]) : cl(colors["textA500"])
        )}
      >
        {prop.label}
        {preview ? <>&nbsp;&nbsp;&nbsp;</> : ""}
      </span>
      <span
        className={cl(
          selected ? colors["textB500"] : colors["textB600"],
          "max-w-[80px] font-normal truncate"
        )}
      >
        {preview}
      </span>
    </div>
  );
}
