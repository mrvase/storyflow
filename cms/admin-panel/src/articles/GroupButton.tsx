import React from "react";
/*
import { ViewColumnsIcon } from "@heroicons/react/24/outline";
import Content from "../layout/components/Content";
import { useSegment } from "../layout/components/SegmentContext";
import { getPathFromSegment } from "../layout/utils";
import { minimizeId } from "@storyflow/backend/ids";
import { targetTools, DocumentConfigOp } from "shared/operations";
import { useCollab } from "../state/collaboration";
import { useFocusedElements } from "../utils/useIsFocused";

function GroupButton() {
  const getElements = useFocusedElements();

  const { current } = useSegment();
  const path = getPathFromSegment(current);

  const [, articleId] = path.split("/").slice(-1)[0].split("-");

  const id = minimizeId(articleId);

  const { push } = useCollab().mutate<DocumentConfigOp>(id, id);

  const onClick = () => {
    const elements = getElements();

    const ops: DocumentConfigOp["ops"] = elements.map((el) => ({
      index: 0,
      insert: [],
      remove: 1,
    }));

    ops.push({
      index: 0,
      insert: elements,
      remove: 0,
    });

    push({
      target: targetTools.stringify({
        field: "any",
        operation: "computation",
        location: "",
      }),
      ops,
    });
  };

  return (
    <Content.Button
      icon={ViewColumnsIcon}
      onClick={onClick}
      onMouseDown={(ev) => {
        ev.stopPropagation();
      }}
    />
  );
}
*/
