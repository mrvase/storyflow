import {
  DocumentId,
  TokenStream,
  NestedField,
  ValueArray,
  DBFolder,
} from "@storyflow/backend/types";
import { createTemplateFieldId, getDocumentId } from "@storyflow/backend/ids";
import { LinkIcon } from "@heroicons/react/24/outline";
import { $getRoot, $getSelection, $isRangeSelection } from "lexical";
import React from "react";
import { useEditorContext } from "../../editor/react/EditorProvider";
import { useAppFolders } from "../../folders/collab/hooks";
import { tools } from "shared/editor-tools";
import { useGlobalState } from "../../state/state";
import { $getComputation, $getIndexFromPoint } from "../Editor/transforms";
import { Option } from "./Option";
import { DEFAULT_FIELDS } from "@storyflow/backend/fields";
import { calculateFromRecord } from "@storyflow/backend/calculate";
import { useFieldId } from "../FieldIdContext";
import { useDocumentIdGenerator } from "../../id-generator";
import { tokens } from "@storyflow/backend/tokens";
import { useOptimisticDocumentList } from "../../documents";
import { markMatchingString } from "../query/helpers";

export function UrlPrompt({
  prompt,
  replacePromptWithStream,
}: {
  prompt: string;
  replacePromptWithStream: (stream: TokenStream) => void;
}) {
  const editor = useEditorContext();

  const getPrevSymbol = () => {
    return editor.getEditorState().read(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection) || !selection.isCollapsed()) return;
      const index = $getIndexFromPoint(selection.anchor) - (prompt.length + 1);
      if (index === 0) return;
      const computation = $getComputation($getRoot());
      return tools.at(computation, index - 1);
    });
  };

  const [linkParent, setLinkParent] = React.useState<NestedField | null>(null);

  const [parentUrl] = useGlobalState<ValueArray>(linkParent?.field);

  React.useEffect(() => {
    const symbol = getPrevSymbol();
    if (tokens.isNestedField(symbol)) {
      setLinkParent(symbol);
    }
  }, []);

  const combinedPrompt = parentUrl?.[0] ? `${parentUrl[0]}/${prompt}` : prompt;

  const apps = useAppFolders();

  return (
    <>
      {apps.map((app) => (
        <AppUrls
          key={app._id}
          app={app}
          prompt={combinedPrompt}
          replacePromptWithStream={replacePromptWithStream}
        />
      ))}
    </>
  );
}

function AppUrls({
  app,
  prompt,
  replacePromptWithStream,
}: {
  app: DBFolder;
  prompt: string;
  replacePromptWithStream: (stream: TokenStream) => void;
}) {
  const id = useFieldId();
  const documentId = getDocumentId(id) as DocumentId;
  const generateDocumentId = useDocumentIdGenerator();

  const { articles: list } = useOptimisticDocumentList(app._id);

  const onEnter = React.useCallback(
    (id: DocumentId) => {
      const nestedField: NestedField = {
        id: generateDocumentId(documentId),
        field: createTemplateFieldId(id, DEFAULT_FIELDS.url.id),
      };
      replacePromptWithStream([nestedField]);
    },
    [replacePromptWithStream]
  );

  const options = (list ?? []).reduce((acc, el) => {
    const url =
      (calculateFromRecord(
        createTemplateFieldId(el._id, DEFAULT_FIELDS.url.id),
        el.record
      )?.[0] as string) ?? "";
    if (url.startsWith(prompt.toLowerCase())) {
      acc.push({
        id: el._id,
        label: markMatchingString(url || "[forside]", prompt),
        onEnterLabel: "Indsæt",
        // secondaryText: "Vis links",
        Icon: LinkIcon,
        onEnter,
      });
      return acc;
    }
    return acc;
  }, [] as any[]);

  return (
    <div className="p-2.5">
      <div className="font-medium opacity-50 mb-1 ml-1">{app.label}</div>
      {options.map(
        ({ id, label, secondaryText, Icon, onEnter, onEnterLabel }) => (
          <Option
            value={id}
            onEnter={onEnter}
            onEnterLabel={onEnterLabel}
            secondaryText={secondaryText}
            Icon={Icon}
          >
            {label}
          </Option>
        )
      )}
    </div>
  );
}
