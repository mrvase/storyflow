import {
  DocumentId,
  TokenStream,
  FolderId,
  NestedFolder,
  NestedDocument,
} from "@storyflow/backend/types";
import { createTemplateFieldId, getDocumentId } from "@storyflow/backend/ids";
import { ComputerDesktopIcon, DocumentIcon } from "@heroicons/react/24/outline";
import React from "react";
import { useFolders } from "../../folders/collab/hooks";
import { Option } from "./Option";
import { useFieldId } from "../FieldIdContext";
import { useDocumentIdGenerator } from "../../id-generator";
import { markMatchingString } from "../query/helpers";
import { SWRClient } from "../../client";
import { calculateFromRecord } from "@storyflow/backend/calculate";
import { DEFAULT_FIELDS } from "@storyflow/backend/fields";
import Loader from "../../elements/Loader";

export function ReferencePrompt({
  prompt,
  replacePromptWithStream,
}: {
  prompt: string;
  replacePromptWithStream: (stream: TokenStream) => void;
}) {
  const apps = useFolders();

  return (
    <>
      <DocumentPrompt
        prompt={prompt}
        replacePromptWithStream={replacePromptWithStream}
      />
      <FolderPrompt
        prompt={prompt}
        replacePromptWithStream={replacePromptWithStream}
      />
    </>
  );
}

function FolderPrompt({
  prompt,
  replacePromptWithStream,
}: {
  prompt: string;
  replacePromptWithStream: (stream: TokenStream) => void;
}) {
  const id = useFieldId();
  const documentId = getDocumentId(id) as DocumentId;
  const generateDocumentId = useDocumentIdGenerator();

  const folders = useFolders();

  const onEnter = React.useCallback(
    (folder: FolderId) => {
      const nestedFolder: NestedFolder = {
        id: generateDocumentId(documentId),
        folder,
      };
      replacePromptWithStream([nestedFolder]);
    },
    [replacePromptWithStream]
  );

  const options = folders
    .filter((el) => el.label.toLowerCase().startsWith(prompt.toLowerCase()))
    .map((el) => ({
      id: el._id,
      label: markMatchingString(el.label, prompt),
      onEnterLabel: "Indsæt",
      Icon: ComputerDesktopIcon,
      onEnter,
    }));

  return (
    <div className="p-2.5">
      <div className="font-normal opacity-50 mb-1 ml-1">Mapper</div>
      {options.map(({ id, label, Icon, onEnter, onEnterLabel }) => (
        <Option
          value={id}
          onEnter={onEnter}
          onEnterLabel={onEnterLabel}
          Icon={Icon}
        >
          {label}
        </Option>
      ))}
    </div>
  );
}

function DocumentPrompt({
  prompt,
  replacePromptWithStream,
}: {
  prompt: string;
  replacePromptWithStream: (stream: TokenStream) => void;
}) {
  const [search, setSearch] = React.useState("");

  const { data, isLoading } = SWRClient.documents.getByLabel.useQuery(search, {
    inactive: search === "",
  });

  React.useEffect(() => {
    if (prompt === "") {
      setSearch("");
    } else {
      const t = setTimeout(() => {
        setSearch(prompt);
      }, 250);
      return () => {
        clearTimeout(t);
      };
    }
  }, [prompt]);

  const onEnter = React.useCallback(
    (id: DocumentId) => {
      const nestedDocument: NestedDocument = {
        id,
      };
      replacePromptWithStream([nestedDocument]);
    },
    [replacePromptWithStream]
  );

  const options = (data ?? []).map((el) => ({
    id: el._id,
    label:
      (calculateFromRecord(
        createTemplateFieldId(el._id, DEFAULT_FIELDS.label.id),
        el.record
      )?.[0] as string) ?? "",
    secondary: el._id,
    Icon: DocumentIcon,
    onEnter,
    onEnterLabel: "Tilføj",
    onArrowRight() {},
    onArrowRightLabel: "Se felter",
  }));

  const isReady = !isLoading && (prompt === "" || search !== "");

  return (
    <div className="p-2.5">
      <div className="font-normal opacity-50 mb-1 ml-1">Dokumenter</div>
      {prompt === "" && (
        <div className="px-1 py-2.5 text-gray-400 italic">Indtast søgning</div>
      )}
      {!isReady && (
        <div className="px-1 py-2.5 h-10 flex items-center text-gray-400 italic">
          <Loader size="md" />
        </div>
      )}
      {isReady && prompt !== "" && options.length === 0 && (
        <div className="px-1 py-2.5 text-gray-400 italic">
          Ingen dokumenter fundet
        </div>
      )}
      {options.map(({ id, label, Icon, onEnter, onEnterLabel }) => (
        <Option
          value={id}
          onEnter={onEnter}
          onEnterLabel={onEnterLabel}
          Icon={Icon}
        >
          {label}
        </Option>
      ))}
    </div>
  );
}
