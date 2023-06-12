import cl from "clsx";
import {
  CheckIcon,
  FunnelIcon,
  ListBulletIcon,
  PencilSquareIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import type { DocumentId, FieldId } from "@storyflow/shared/types";
import type { FieldType2 } from "@storyflow/cms/types";
import React from "react";
import ReactDOM from "react-dom";
import { useDocumentList } from ".";
import { useTemplateFolder } from "../folders/FoldersContext";
import Content from "../pages/Content";
import { usePush } from "../collab/CollabContext";
import { useFieldConfig } from "./document-config";
import { useContextWithError } from "../utils/contextError";
import { useFieldId } from "../fields/FieldIdContext";
import { getDocumentId } from "@storyflow/cms/ids";
import { Menu } from "../elements/Menu";
import { useTopFieldIndex } from "./FieldIndexContext";
import { DocumentTransactionEntry } from "../operations/actions";
import { getDocumentLabel } from "./useDocumentLabel";
import { useTranslation } from "../translation/TranslationContext";

const FieldToolbarPortalContext = React.createContext<
  [HTMLDivElement | null, React.Dispatch<HTMLDivElement | null>] | null
>(null);

export function FieldToolbarPortalProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const state = React.useState<HTMLDivElement | null>(null);
  return (
    <FieldToolbarPortalContext.Provider value={state}>
      {children}
    </FieldToolbarPortalContext.Provider>
  );
}

export function useFieldToolbarPortal() {
  return useContextWithError(
    FieldToolbarPortalContext,
    "FieldToolbarPortal"
  )?.[1];
}

export function FieldToolbarPortal({ show }: { show: boolean }) {
  const portal = useContextWithError(
    FieldToolbarPortalContext,
    "FieldToolbarPortal"
  )?.[0];

  return portal && show
    ? ReactDOM.createPortal(<FieldToolbar />, portal)
    : null;
}

const restrictToOptions = [
  { id: "children" as "children", label: "Rich Text" },
  { id: "number" as "number", label: "Tal" },
  { id: "image" as "image", label: "Billede" },
  { id: "color" as "color", label: "Farve" },
];

export function FieldToolbar() {
  const t = useTranslation();
  const fieldId = useFieldId();
  const topIndex = useTopFieldIndex();
  const documentId = getDocumentId<DocumentId>(fieldId);

  const [config, setConfig] = useFieldConfig(fieldId);

  const push = usePush<DocumentTransactionEntry>(documentId, "config");

  const templateFolder = useTemplateFolder()?._id;
  const { documents: templates } = useDocumentList(templateFolder);

  const templateOptions = React.useMemo(
    () =>
      (templates ?? [])
        .filter((el) => el.folder)
        .map((el) => ({
          id: el._id,
          label: getDocumentLabel(el, t),
        })),
    [templates]
  );

  return (
    <>
      {/*<FieldLabel id={fieldId} label={config?.label ?? ""} />*/}
      <Menu<{ id: DocumentId; label: string }>
        as={Content.ToolbarButton}
        icon={ListBulletIcon}
        label="Vælg skabelon"
        onSelect={(el) => setConfig("template", el.id)}
        onClear={() => setConfig("template", undefined)}
        selected={
          config?.template
            ? templateOptions.find((el) => el.id === config.template)
            : undefined
        }
        options={templateOptions}
      />
      <Menu<{ id: FieldType2; label: string }>
        as={Content.ToolbarButton}
        icon={FunnelIcon}
        label="Begræns til"
        onSelect={(el) => setConfig("type2", el.id)}
        onClear={() => setConfig("type2", undefined)}
        selected={
          config?.type2
            ? restrictToOptions.find((el) => el.id === config.type2)
            : undefined
        }
        options={restrictToOptions}
      />
      {typeof topIndex === "number" && (
        <Content.ToolbarButton
          data-focus-remain="true"
          onClick={() => {
            push([["", [[topIndex, 1]]]]);
          }}
        >
          <TrashIcon className="w-4 h-4" />
        </Content.ToolbarButton>
      )}
    </>
  );
}
