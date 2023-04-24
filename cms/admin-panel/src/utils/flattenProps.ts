import { extendPath } from "@storyflow/backend/extendPath";
import { computeFieldId, getIdFromString } from "@storyflow/backend/ids";
import { FieldId, NestedDocumentId } from "@storyflow/backend/types";
import {
  PropConfig,
  PropConfigArray,
  PropGroup,
  RegularOptions,
} from "@storyflow/frontend/types";

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
