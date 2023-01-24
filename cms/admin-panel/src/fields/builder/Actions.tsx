import Content from "../../layout/components/Content";
import {
  ArrowDownRightIcon,
  ArrowUpLeftIcon,
  SquaresPlusIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { ComputationOp, targetTools } from "shared//operations";
import { createComponent } from "../Editor/ContentPlugin";
import { useClientConfig } from "../../client-config";
import { useCollab } from "../../state/collaboration";

export default function Actions({
  id,
  index,
  type,
  parentPath,
  defaultComponent,
}: {
  id: string;
  index: number | undefined;
  type: string | undefined;
  parentPath?: string;
  defaultComponent: string | undefined;
}) {
  const { push } = useCollab().mutate<ComputationOp>(
    id.slice(0, 4),
    id.slice(4, 16)
  );

  const config = useClientConfig();

  return (
    <Content.Buttons>
      <Content.Button
        icon={SquaresPlusIcon}
        onMouseDown={(ev) => {
          ev.preventDefault();
        }}
        onClick={() => {
          if (!defaultComponent || typeof index !== "number") return;
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
                insert: [createComponent(type ?? defaultComponent, config)],
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
          if (!defaultComponent || typeof index !== "number") return;
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
                insert: [createComponent(type ?? defaultComponent, config)],
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
