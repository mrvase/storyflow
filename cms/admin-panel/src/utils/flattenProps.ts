import { computeFieldId, getIdFromString } from "@storyflow/cms/ids";
import type { NestedDocumentId } from "@storyflow/shared/types";
import {
  PropConfig,
  PropConfigRecord,
  PropGroup,
} from "@storyflow/shared/types";
import { extendPath } from "./extendPath";

export function flattenProps<T = PropConfig & { name: string }>(
  props: PropConfigRecord,
  transform: (
    el: PropConfig & { name: string },
    group: { label: string; name: string } | undefined
  ) => T = (el) => el as T
): T[] {
  return Object.entries(props).reduce((acc: T[], [name, el]) => {
    if (el.type === "group") {
      const group = { ...el, name };
      acc.push(
        ...Object.entries(el.props).map(([nestedName, nested]) =>
          transform({ ...nested, name: nestedName }, group)
        )
      );
    } else if (el.type === "input") {
      const group = { ...el, name };
      acc.push(
        ...Object.entries({
          label: { type: "string" as "string", label: "Label" },
          ...el.props,
        }).map(([nestedName, nested]) =>
          transform({ ...nested, name: nestedName }, group)
        )
      );
    } else {
      acc.push(transform({ ...el, name }, undefined));
    }
    return acc;
  }, []);
}

export function flattenPropsWithIds(
  id: NestedDocumentId,
  props: PropConfigRecord
) {
  return flattenProps(props, (el, group) => ({
    id: group
      ? computeFieldId(
          id,
          getIdFromString(extendPath(group.name, el.name, "#"))
        )
      : computeFieldId(id, getIdFromString(el.name)),
    ...el,
    // smaller spaces on purpose
    label: group ? `${group.label} · ${el.label}` : el.label,
  }));
}

export function getPropIds(
  props: PropConfigRecord,
  elementId: NestedDocumentId
) {
  return flattenProps(props, (config, group) => {
    const name = group ? `${group.name}#${config.name}` : config.name;
    return computeFieldId(elementId, getIdFromString(name));
  });
}
