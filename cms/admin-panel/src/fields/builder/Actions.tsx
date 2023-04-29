import {
  ArrowDownRightIcon,
  ArrowUpLeftIcon,
  SquaresPlusIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { createComponent } from "../Editor/createComponent";
import { getInfoFromType, useClientConfig } from "../../client-config";
import { getDocumentId, getRawFieldId } from "@storyflow/fields-core/ids";
import type { DocumentId, FieldId } from "@storyflow/shared/types";
import { useDocumentIdGenerator } from "../../id-generator";
import { usePush } from "../../collab/CollabContext";
import { FieldTransactionEntry } from "operations/actions_new";

function Button(props: any) {
  return null;
}

/*
export function Actions({
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
  const push = useDocumentPush<FieldTransactionEntry>(
    getDocumentId(id),
    getRawFieldId(id)
  );

  const documentId = getDocumentId(id) as DocumentId;
  const generateDocumentId = useDocumentIdGenerator();

  const { libraries } = useClientConfig();

  return (
    <>
      <Button
        icon={SquaresPlusIcon}
        onMouseDown={(ev: any) => {
          ev.preventDefault();
        }}
        onClick={() => {
          if (!type || typeof index !== "number") return;
          const { name, library } = getInfoFromType(type);
          push([
            parentPath ? parentPath.split(".").slice(1).join(".") : "",
            [
              {
                index,
                insert: [
                  createComponent(generateDocumentId(documentId), name, {
                    library,
                    libraries,
                  }),
                ],
              },
            ],
          ]);
        }}
        className="rotate-180"
      />
      <Button
        icon={SquaresPlusIcon}
        onMouseDown={(ev: any) => {
          ev.preventDefault();
        }}
        onClick={() => {
          if (!type || typeof index !== "number") return;
          const { name, library } = getInfoFromType(type);
          push([
            parentPath ? parentPath.split(".").slice(1).join(".") : "",
            [
              {
                index: index + 1,
                insert: [
                  createComponent(generateDocumentId(documentId), name, {
                    library,
                    libraries,
                  }),
                ],
              },
            ],
          ]);
        }}
      />
      <Button
        icon={ArrowUpLeftIcon}
        onMouseDown={(ev: any) => {
          ev.preventDefault();
        }}
        onClick={() => {
          if (typeof index !== "number") return;
          push([
            parentPath ? parentPath.split(".").slice(1).join(".") : "",
            [
              {
                index,
                remove: 1,
              },
              {
                index: index - 1,
              },
            ],
          ]);
        }}
      />
      <Button
        icon={ArrowDownRightIcon}
        onMouseDown={(ev: any) => {
          ev.preventDefault();
        }}
        onClick={() => {
          if (typeof index !== "number") return;
          push([
            parentPath ? parentPath.split(".").slice(1).join(".") : "",
            [
              {
                index,
                remove: 1,
              },
              {
                index: index + 1,
              },
            ],
          ]);
        }}
      />
      <Button
        icon={TrashIcon}
        onMouseDown={(ev: any) => {
          ev.preventDefault();
        }}
        onClick={() => {
          if (typeof index !== "number") return;
          push([
            parentPath ? parentPath.split(".").slice(1).join(".") : "",
            [
              {
                index,
                remove: 1,
              },
            ],
          ]);
        }}
      />
    </>
  );
}
*/
