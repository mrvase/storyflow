import {
  DocumentId,
  FolderId,
  NestedFolder,
  NestedDocument,
  FieldId,
  NestedDocumentId,
} from "@storyflow/shared/types";
import type { FieldConfig, NestedField } from "@storyflow/cms/types";
import type { TokenStream, HasSelect } from "../../operations/types";
import {
  computeFieldId,
  createRawTemplateFieldId,
  createTemplateFieldId,
  getDocumentId,
  getIdFromString,
  getRawDocumentId,
  getRawFieldId,
} from "@storyflow/cms/ids";
import {
  Bars3BottomLeftIcon,
  ComputerDesktopIcon,
  DocumentIcon,
} from "@heroicons/react/24/outline";
import React from "react";
import { Option } from "./Option";
import { useFieldId } from "../FieldIdContext";
import { useDocumentIdGenerator } from "../../id-generator";
import { markMatchingString } from "./helpers";
import { SWRClient } from "../../client";
import { calculateRootFieldFromRecord } from "@storyflow/cms/calculate-server";
import { DEFAULT_FIELDS } from "@storyflow/cms/default-fields";
import Loader from "../../elements/Loader";
import { useFieldConfig } from "../../documents/document-config";
import { usePath, useSelectedPath } from "../Path";
import { useLoopTemplate } from "../default/LoopTemplateContext";
import { useTemplate } from "../default/useFieldTemplate";
import { useFolders } from "../../folders/FoldersContext";

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
  const fieldId = useFieldId();
  const documentId = getDocumentId(fieldId) as DocumentId;
  const [{ selectedPath }] = useSelectedPath();
  const path = usePath();
  const fullPath = React.useMemo(
    () => [...selectedPath, ...path],
    [selectedPath, path]
  );

  const templates = fullPath
    .filter((_, i) => i % 2)
    .reduce(
      (
        acc: { element: NestedDocumentId; fields: FieldConfig[] | undefined }[],
        el
      ) => {
        const id = useLoopTemplate(el)[0] as DocumentId | undefined;
        if (id) {
          acc.push({
            element: el as NestedDocumentId,
            fields: useTemplate(id),
          });
        }
        return acc;
      },
      []
    );

  const generateDocumentId = useDocumentIdGenerator();

  const onEnter = React.useCallback(
    ({ element, field }: { element: NestedDocumentId; field: FieldId }) => {
      const nestedField: HasSelect<NestedField> = {
        id: generateDocumentId(documentId),
        field: computeFieldId(element, getIdFromString("data")),
        select: createRawTemplateFieldId(field),
        loop: getRawDocumentId(element),
      };
      replacePromptWithStream([nestedField]);
      /*
      if (templateId && !fieldConfig?.template) {
        setFieldConfig("template", templateId);
      }
      */
    },
    [replacePromptWithStream, generateDocumentId]
  );

  if (getRawFieldId(path.slice(-1)[0] as FieldId) === getIdFromString("data")) {
    return null;
  }

  return (
    <>
      {templates.map(({ element, fields }, index) => (
        <TemplateFieldPromptOptions
          key={element}
          element={element}
          prompt={prompt}
          fields={fields}
          onEnter={onEnter}
          index={index}
        />
      ))}
    </>
  );
}

function TemplateFieldPromptOptions({
  element,
  prompt,
  fields,
  onEnter,
  index,
}: {
  element: NestedDocumentId;
  prompt: string;
  fields: FieldConfig[] | undefined;
  onEnter: (value: { element: NestedDocumentId; field: FieldId }) => void;
  index: number;
}) {
  if (!fields) {
    return null;
  }

  const options = React.useMemo(
    () =>
      (fields ?? [])
        .filter((el) => el.label.toLowerCase().startsWith(prompt.toLowerCase()))
        .map((el) => ({
          value: {
            element: element,
            field: el.id,
          },
          label: markMatchingString(el.label, prompt),
        })),
    [fields, prompt]
  );

  return (
    <div className="p-2.5">
      <div className="font-medium text-gray-400 mb-1 ml-1">
        Felter fra Gentag {index + 1}
      </div>
      {options.map(({ value, label }) => (
        <Option
          key={`${value.element}${value.field}`}
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

  const folders = Array.from(useFolders().values());

  const [fieldConfig, setFieldConfig] = useFieldConfig(fieldId);

  const onEnter = React.useCallback(
    ({ folder, templateId }: { folder: FolderId; templateId?: DocumentId }) => {
      const nestedFolder: NestedFolder = {
        id: generateDocumentId(documentId),
        folder,
      };
      replacePromptWithStream([nestedFolder]);
      if (templateId && !fieldConfig?.template) {
        setFieldConfig("template", templateId);
      }
    },
    [replacePromptWithStream, fieldConfig, setFieldConfig, generateDocumentId]
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
          key={value.folder}
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

  const { data, isLoading } = SWRClient.documents.findByLabel.useQuery(search, {
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
      if (templateId && !fieldConfig?.template) {
        setFieldConfig("template", templateId);
      }
    },
    [replacePromptWithStream, fieldConfig, setFieldConfig]
  );

  const folders = Array.from(useFolders().values());

  const options = React.useMemo(
    () =>
      (data ?? []).map((el) => ({
        value: {
          id: el._id,
          templateId: folders.find((f) => f._id === el.folder)?.template,
        },
        label:
          (calculateRootFieldFromRecord(
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
          key={value.id}
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
