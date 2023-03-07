import Content from "../../layout/components/Content";
import {
  ArrowDownRightIcon,
  ArrowUpLeftIcon,
  SquaresPlusIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { ComputationOp, targetTools } from "shared//operations";
import { createComponent } from "../Editor/createComponent";
import { getInfoFromType, useClientConfig } from "../../client-config";
import { useDocumentCollab } from "../../state/collab-document";
import { getDocumentId, getTemplateFieldId } from "@storyflow/backend/ids";
import { FieldId } from "@storyflow/backend/types";

export default function Actions({
  id,
  index,
  type,
  parentPath,
}: {
  id: FieldId;
  index: number | undefined;
  type: string | undefined;
  parentPath?: string;
}) {
  const { push } = useDocumentCollab().mutate<ComputationOp>(
    getDocumentId(id),
    getTemplateFieldId(id)
  );

  const { libraries } = useClientConfig();

  return (
    <Content.Buttons>
      <Content.Button
        icon={SquaresPlusIcon}
        onMouseDown={(ev) => {
          ev.preventDefault();
        }}
        onClick={() => {
          if (!type || typeof index !== "number") return;
          const { name, library } = getInfoFromType(type);
          push({
            target: targetTools.stringify({
              field: "default",
              operation: "computation",
              location: parentPath
                ? parentPath.split(".").slice(1).join(".")
                : "",
            }),
            ops: [
              {
                index,
                insert: [createComponent(name, { library, libraries })],
              },
            ],
          });
        }}
        className="rotate-180"
      />
      <Content.Button
        icon={SquaresPlusIcon}
        onMouseDown={(ev) => {
          ev.preventDefault();
        }}
        onClick={() => {
          if (!type || typeof index !== "number") return;
          const { name, library } = getInfoFromType(type);
          push({
            target: targetTools.stringify({
              field: "default",
              operation: "computation",
              location: parentPath
                ? parentPath.split(".").slice(1).join(".")
                : "",
            }),
            ops: [
              {
                index: index + 1,
                insert: [createComponent(name, { library, libraries })],
              },
            ],
          });
        }}
      />
      <Content.Button
        icon={ArrowUpLeftIcon}
        onMouseDown={(ev) => {
          ev.preventDefault();
        }}
        onClick={() => {
          if (typeof index !== "number") return;
          push({
            target: targetTools.stringify({
              field: "default",
              operation: "computation",
              location: parentPath
                ? parentPath.split(".").slice(1).join(".")
                : "",
            }),
            ops: [
              {
                index,
                remove: 1,
              },
              {
                index: index - 1,
              },
            ],
          });
        }}
      />
      <Content.Button
        icon={ArrowDownRightIcon}
        onMouseDown={(ev) => {
          ev.preventDefault();
        }}
        onClick={() => {
          if (typeof index !== "number") return;
          push({
            target: targetTools.stringify({
              field: "default",
              operation: "computation",
              location: parentPath
                ? parentPath.split(".").slice(1).join(".")
                : "",
            }),
            ops: [
              {
                index,
                remove: 1,
              },
              {
                index: index + 1,
              },
            ],
          });
        }}
      />
      <Content.Button
        icon={TrashIcon}
        onMouseDown={(ev) => {
          ev.preventDefault();
        }}
        onClick={() => {
          if (typeof index !== "number") return;
          push({
            target: targetTools.stringify({
              field: "default",
              operation: "computation",
              location: parentPath
                ? parentPath.split(".").slice(1).join(".")
                : "",
            }),
            ops: [
              {
                index,
                remove: 1,
              },
            ],
          });
        }}
      />
    </Content.Buttons>
  );
}
