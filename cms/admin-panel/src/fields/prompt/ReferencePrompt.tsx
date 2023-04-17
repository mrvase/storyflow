import {
  DocumentId,
  TokenStream,
  FolderId,
  NestedFolder,
  NestedDocument,
  FieldId,
} from "@storyflow/backend/types";
import { createTemplateFieldId, getDocumentId } from "@storyflow/backend/ids";
import {
  Bars3BottomLeftIcon,
  ComputerDesktopIcon,
  DocumentIcon,
} from "@heroicons/react/24/outline";
import React from "react";
import { useFolders } from "../../folders/collab/hooks";
import { Option } from "./Option";
import { useFieldId } from "../FieldIdContext";
import { useDocumentIdGenerator } from "../../id-generator";
import { markMatchingString } from "./helpers";
import { SWRClient } from "../../client";
import { calculateFromRecord } from "@storyflow/backend/calculate";
import { DEFAULT_FIELDS } from "@storyflow/backend/fields";
import Loader from "../../elements/Loader";
import { useFieldConfig } from "../../documents/collab/hooks";
import { usePath } from "../Path";
import { useLoopTemplate } from "../default/LoopTemplateContext";
import { useTemplate } from "../default/useFieldTemplate";

export function ReferencePrompt({
  prompt,
  replacePromptWithStream,
}: {
  prompt: string;
  replacePromptWithStream: (stream: TokenStream) => void;
}) {
  return (
    <>
      <TemplateFieldPrompt
        prompt={prompt}
        replacePromptWithStream={replacePromptWithStream}
      />
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

function TemplateFieldPrompt({
  prompt,
  replacePromptWithStream,
}: {
  prompt: string;
  replacePromptWithStream: (stream: TokenStream) => void;
}) {
  const id = useFieldId();
  const documentId = getDocumentId(id) as DocumentId;
  const generateDocumentId = useDocumentIdGenerator();

  const path = usePath();

  const template = path
    .map((el, i) => {
      if (i % 2) {
        return useLoopTemplate(el)[0];
      }
    })
    .find(Boolean);

  const fields = useTemplate(template as DocumentId);

  const onEnter = React.useCallback(
    (id: FieldId) => {
      console.log("FIELD ID", id);
    },
    [replacePromptWithStream]
  );

  if (!template) {
    return null;
  }

  const options = (fields ?? [])
    .filter((el) => el.label.toLowerCase().startsWith(prompt.toLowerCase()))
    .map((el) => ({
      value: el.id,
      label: markMatchingString(el.label, prompt),
    }));

  return (
    <div className="p-2.5">
      <div className="font-medium text-gray-400 mb-1 ml-1">
        Felter fra Gentag
      </div>
      {options.map(({ value, label }) => (
        <Option
          value={value}
          onEnter={onEnter}
          onEnterLabel={"Indsæt"}
          Icon={Bars3BottomLeftIcon}
        >
          {label}
        </Option>
      ))}
    </div>
  );
}

function FolderPrompt({
  prompt,
  replacePromptWithStream,
}: {
  prompt: string;
  replacePromptWithStream: (stream: TokenStream) => void;
}) {
  const fieldId = useFieldId();
  const documentId = getDocumentId(fieldId) as DocumentId;
  const generateDocumentId = useDocumentIdGenerator();

  const folders = useFolders();

  const [fieldConfig, setFieldConfig] = useFieldConfig(fieldId);

  const onEnter = React.useCallback(
    ({ folder, templateId }: { folder: FolderId; templateId?: DocumentId }) => {
      const nestedFolder: NestedFolder = {
        id: generateDocumentId(documentId),
        folder,
      };
      replacePromptWithStream([nestedFolder]);
      console.log("HERE 2", templateId);
      if (templateId && !fieldConfig?.template) {
        setFieldConfig("template", templateId);
      }
    },
    [replacePromptWithStream, fieldConfig, setFieldConfig]
  );

  const options = folders
    .filter((el) => el.label.toLowerCase().startsWith(prompt.toLowerCase()))
    .map((el) => ({
      value: {
        folder: el._id,
        templateId: el.template,
      },
      label: markMatchingString(el.label, prompt),
      onEnterLabel: "Indsæt",
      Icon: ComputerDesktopIcon,
      onEnter,
    }));

  return (
    <div className="p-2.5">
      <div className="font-medium text-gray-400 mb-1 ml-1">Mapper</div>
      {options.map(({ value, label, Icon, onEnter, onEnterLabel }) => (
        <Option
          value={value}
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

  const fieldId = useFieldId();
  const [fieldConfig, setFieldConfig] = useFieldConfig(fieldId);

  const onEnter = React.useCallback(
    ({ id, templateId }: { id: DocumentId; templateId?: DocumentId }) => {
      const nestedDocument: NestedDocument = {
        id,
      };
      replacePromptWithStream([nestedDocument]);
      console.log("HERE", templateId, fieldConfig);
      if (templateId && !fieldConfig?.template) {
        setFieldConfig("template", templateId);
      }
    },
    [replacePromptWithStream, fieldConfig, setFieldConfig]
  );

  const folders = useFolders();

  const options = React.useMemo(
    () =>
      (data ?? []).map((el) => ({
        value: {
          id: el._id,
          templateId: folders.find((f) => f._id === el.folder)?.template,
        },
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
      })),
    [data, folders, onEnter]
  );

  const isReady = !isLoading && (prompt === "" || search !== "");

  return (
    <div className="p-2.5">
      <div className="font-medium text-gray-400 mb-1 ml-1">Dokumenter</div>
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
      {options.map(({ value, label, Icon, onEnter, onEnterLabel }) => (
        <Option
          value={value}
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
