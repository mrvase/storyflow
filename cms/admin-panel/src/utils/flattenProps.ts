import { extendPath } from "@storyflow/backend/extendPath";
import { computeFieldId, getIdFromString } from "@storyflow/backend/ids";
import { FieldId, NestedDocumentId } from "@storyflow/backend/types";
import {
  PropConfig,
  PropConfigArray,
  RegularOptions,
} from "@storyflow/frontend/types";

export function flattenProps(
  id: NestedDocumentId,
  props: PropConfigArray<RegularOptions>
) {
  return props.reduce(
    (acc: (PropConfig<RegularOptions> & { id: FieldId })[], el) =>
      el.type === "group"
        ? [
            ...acc,
            ...el.props.map((nested) => ({
              id: computeFieldId(
                id,
                getIdFromString(extendPath(el.name, nested.name, "#"))
              ),
              ...nested,
              label: `${el.label} · ${nested.label}`,
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
}
