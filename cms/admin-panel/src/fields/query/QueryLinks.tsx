import {
  DocumentId,
  EditorComputation,
  FieldImport,
  Value,
} from "@storyflow/backend/types";
import { URL_ID } from "@storyflow/backend/templates";
import { computeFieldId, createId } from "@storyflow/backend/ids";
import { ComputerDesktopIcon, LinkIcon } from "@heroicons/react/24/outline";
import { $getRoot, $getSelection, $isRangeSelection } from "lexical";
import React from "react";
import { SWRClient } from "../../client";
import { useEditorContext } from "../../editor/react/EditorProvider";
import { useAppFolders } from "../../folders";
import { tools } from "shared/editor-tools";
import { useGlobalState } from "../../state/state";
import { $getComputation, $getIndexFromPoint } from "../Editor/transforms";
import { Option as OptionComponent } from "./Option";
import { markMatchingString } from "./helpers";

export function QueryLinks({
  query,
  selected,
  insertComputation,
}: {
  query: string;
  selected: number;
  insertComputation: (insert: EditorComputation, removeExtra?: boolean) => void;
}) {
  const editor = useEditorContext();

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

  const [linkParent, setLinkParent] = React.useState<FieldImport | null>(null);

  const [parentUrl] = useGlobalState<Value[]>(linkParent?.fref);

  React.useEffect(() => {
    const symbol = getPrevSymbol();
    if (tools.isFieldImport(symbol)) {
      setLinkParent(symbol);
    }
  }, []);

  const fullQuery = parentUrl?.[0] ? `${parentUrl[0]}/${query}` : query;

  let options: any[] = [];

  const apps = useAppFolders();

  const [app, setApp] = React.useState(
    apps?.length === 1 ? apps[0].id : undefined
  );

  const { data: list } = SWRClient.articles.getList.useQuery(app as string, {
    inactive: !app,
  });

  const onAppEnter = React.useCallback((id: string) => {
    setApp(id);
  }, []);

  const onEnter = React.useCallback(
    (id: DocumentId) => {
      const fieldImport: FieldImport = {
        id: createId(1),
        fref: computeFieldId(id, URL_ID),
        args: {},
      };
      insertComputation([fieldImport], Boolean(parentUrl));
    },
    [parentUrl, query]
  );

  if (!app) {
    options =
      apps?.map((el) => ({
        id: el.id,
        label: el.label,
        // secondaryText: "Vis links",
        Icon: ComputerDesktopIcon,
        onEnter: onAppEnter,
        onEnterLabel: "Vis links",
      })) ?? [];
  } else if (list) {
    options = list.articles.reduce((acc, el) => {
      const url = (el.values[URL_ID]?.[0] as string) || "";
      if (url.startsWith(fullQuery.toLowerCase())) {
        acc.push({
          id: el.id,
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
