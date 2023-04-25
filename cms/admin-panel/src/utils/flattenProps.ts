import { computeFieldId, getIdFromString } from "@storyflow/fields-core/ids";
import type { NestedDocumentId } from "@storyflow/shared/types";
import {
  PropConfig,
  PropConfigArray,
  PropGroup,
  RegularOptions,
} from "@storyflow/shared/types";
import { extendPath } from "./extendPath";

export function flattenProps<T = PropConfig<RegularOptions>>(
  props: PropConfigArray<RegularOptions>,
  transform: (
    el: PropConfig<RegularOptions>,
    group: PropGroup<RegularOptions> | undefined
  ) => T = (el) => el as T
): T[] {
  return props.reduce(
    (acc: T[], el) =>
      el.type === "group"
        ? [...acc, ...el.props.map((nested) => transform(nested, el))]
        : [...acc, transform(el, undefined)],
    []
  );
}

export function flattenPropsWithIds(
  id: NestedDocumentId,
  props: PropConfigArray<RegularOptions>
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
