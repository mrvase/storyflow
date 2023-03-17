import {
  DocumentId,
  TokenStream,
  FolderId,
  NestedField,
  Value,
  ValueArray,
} from "@storyflow/backend/types";
import { computeFieldId, getDocumentId } from "@storyflow/backend/ids";
import { ComputerDesktopIcon, LinkIcon } from "@heroicons/react/24/outline";
import { $getRoot, $getSelection, $isRangeSelection } from "lexical";
import React from "react";
import { SWRClient } from "../../client";
import { useEditorContext } from "../../editor/react/EditorProvider";
import { useAppFolders } from "../../folders/collab/hooks";
import { tools } from "shared/editor-tools";
import { useGlobalState } from "../../state/state";
import { $getComputation, $getIndexFromPoint } from "../Editor/transforms";
import { Option as OptionComponent } from "./Option";
import { markMatchingString } from "./helpers";
import { FIELDS } from "@storyflow/backend/fields";
import { calculateFromRecord } from "@storyflow/backend/calculate";
import { useFieldId } from "../FieldIdContext";
import { useDocumentIdGenerator } from "../../id-generator";
import { tokens } from "@storyflow/backend/tokens";

export function QueryLinks({
  query,
  selected,
  insertComputation,
}: {
  query: string;
  selected: number;
  insertComputation: (insert: TokenStream, removeExtra?: boolean) => void;
}) {
  const editor = useEditorContext();

  const id = useFieldId();
  const documentId = getDocumentId(id) as DocumentId;
  const generateDocumentId = useDocumentIdGenerator();

  const getPrevSymbol = () => {
    return editor.getEditorState().read(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection) || !selection.isCollapsed()) return;
      const index = $getIndexFromPoint(selection.anchor) - (query.length + 1);
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

  const fullQuery = parentUrl?.[0] ? `${parentUrl[0]}/${query}` : query;

  let options: any[] = [];

  const apps = useAppFolders();

  const [app, setApp] = React.useState(
    apps?.length === 1 ? apps[0]._id : undefined
  );

  const { data: list } = SWRClient.documents.getList.useQuery(app as string, {
    inactive: !app,
  });

  const onAppEnter = React.useCallback((id: FolderId) => {
    setApp(id);
  }, []);

  const onEnter = React.useCallback(
    (id: DocumentId) => {
      const fieldImport: NestedField = {
        id: generateDocumentId(documentId),
        field: computeFieldId(id, FIELDS.url.id),
      };
      insertComputation([fieldImport], Boolean(parentUrl));
    },
    [parentUrl, query]
  );

  if (!app) {
    options =
      apps?.map((el) => ({
        id: el._id,
        label: el.label,
        // secondaryText: "Vis links",
        Icon: ComputerDesktopIcon,
        onEnter: onAppEnter,
        onEnterLabel: "Vis links",
      })) ?? [];
  } else if (list) {
    options = list.articles.reduce((acc, el) => {
      const url =
        (calculateFromRecord(
          computeFieldId(el._id, FIELDS.url.id),
          el.record
        )?.[0] as string) ?? "";
      if (url.startsWith(fullQuery.toLowerCase())) {
        acc.push({
          id: el._id,
          label: markMatchingString(url, fullQuery) || "[forside]",
          onEnterLabel: "Indsæt",
          // secondaryText: "Vis links",
          Icon: LinkIcon,
          onEnter,
        });
        return acc;
      }
      return acc;
    }, [] as any[]);
  }

  const current = selected < 0 ? selected : selected % options.length;

  return (
    <>
      {options.map(
        ({ id, label, secondaryText, Icon, onEnter, onEnterLabel }, index) => (
          <OptionComponent
            value={id}
            onEnter={onEnter}
            onEnterLabel={onEnterLabel}
            isSelected={index === current}
            secondaryText={secondaryText}
            Icon={Icon}
          >
            {label}
          </OptionComponent>
        )
      )}
    </>
  );
}
