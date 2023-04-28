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
import type { FieldType2 } from "@storyflow/fields-core/types";
import React from "react";
import ReactDOM from "react-dom";
import { useOptimisticDocumentList } from ".";
import { useTemplateFolder } from "../folders/FoldersContext";
import Content from "../layout/components/Content";
import { useDocumentPush } from "./collab/DocumentCollabContext";
import { useFieldConfig } from "./collab/hooks";
import { useContextWithError } from "../utils/contextError";
import { useFieldId } from "../fields/FieldIdContext";
import { getDocumentId } from "@storyflow/fields-core/ids";
import { Menu } from "../layout/components/Menu";
import { useTopFieldIndex } from "./FieldIndexContext";
import { DocumentTransactionEntry } from "operations/actions_new";

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
  const fieldId = useFieldId();
  const topIndex = useTopFieldIndex();
  const documentId = getDocumentId(fieldId);

  const [config, setConfig] = useFieldConfig(fieldId);

  const push = useDocumentPush<DocumentTransactionEntry>(documentId, "config");

  const templateFolder = useTemplateFolder()?._id;
  const { documents: templates } = useOptimisticDocumentList(templateFolder);

  const templateOptions = React.useMemo(
    () =>
      (templates ?? []).map((el) => ({
        id: el._id,
        label: el.label ?? el._id,
      })),
    [templates]
  );

  return (
    <Content.Toolbar>
      <div className="h-6 px-2 flex-center gap-1.5 rounded dark:bg-yellow-400/10 dark:text-yellow-200/75 ring-1 ring-yellow-200/50 text-xs whitespace-nowrap pointer-events-none">
        1 valgt
        <XMarkIcon className="w-3 h-3" />
      </div>
      <FieldLabel id={fieldId} label={config?.label ?? ""} />
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
    </Content.Toolbar>
  );
}

function FieldLabel({ id, label }: { id: FieldId; label: string }) {
  const documentId = getDocumentId(id);
  const push = useDocumentPush<DocumentTransactionEntry>(documentId, "config");

  const onChange = (value: string) => {
    push([[id, [["label", value]]]]);
  };
  return <EditableLabel value={label} onChange={onChange} />;
}

function EditableLabel({
  value: initialValue,
  onChange,
  className,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  label?: string;
}) {
  const ref = React.useRef<HTMLInputElement | null>(null);

  const [isEditing, setIsEditing] = React.useState(false);

  const [value, setValue] = React.useState(initialValue);

  React.useLayoutEffect(() => {
    setValue(initialValue);
    setWidth();
  }, [initialValue]);

  React.useLayoutEffect(() => setWidth(), [isEditing]);

  const setWidth = () => {
    if (ref.current) {
      ref.current.style.width = "0px";
      let value = ref.current.value;
      if (value === "") ref.current.value = "Ingen label";
      const newWidth = ref.current.scrollWidth;
      if (value === "") ref.current.value = "";
      ref.current.style.width = `${newWidth}px`;
    }
  };

  const handleChange = (ev: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = ev.target.value;
    ReactDOM.flushSync(() => {
      setValue(newValue);
    });
    setWidth();
  };

  const rejected = React.useRef(false);

  const accept = () => {
    if (!rejected.current) {
      if (value !== initialValue) {
        onChange(value);
      }
    } else {
      rejected.current = false;
    }
  };

  const reject = () => {
    setValue(initialValue);
    rejected.current = true;
  };

  const id = React.useId();

  return (
    <div
      className={cl(
        " text-xs text-gray-300 flex h-6 ring-1 rounded",
        isEditing ? "ring-gray-600" : "ring-button"
      )}
      data-focus-remain="true"
    >
      <label className="flex">
        {label && (
          <div className="h-6 px-2 flex-center bg-gray-750 rounded">
            {label}
          </div>
        )}
        <input
          id={id}
          ref={ref}
          value={isEditing ? value : initialValue}
          onChange={handleChange}
          type="text"
          className={cl(
            "outline-none padding-0 margin-0 bg-transparent h-6 items-center px-2",
            className
          )}
          placeholder="Ingen label"
          onFocus={() => {
            setIsEditing(true);
            rejected.current = false;
          }}
          onBlur={() => {
            setIsEditing(false);
            accept();
          }}
          onKeyDown={(ev) => {
            if (ev.key.toLowerCase() === "enter") {
              ref.current?.blur();
            }
            if (ev.key.toLowerCase() === "escape") {
              reject();
              ref.current?.blur();
            }
          }}
        />
        {!isEditing && (
          <div className="mr-2 h-full flex-center cursor-text">
            <PencilSquareIcon className="w-3 h-3" />
          </div>
        )}
      </label>
      {isEditing && (
        <>
          <div
            className="h-6 w-6 flex-center bg-gray-750 hover:bg-green-700/60 transition-colors rounded-l"
            onMouseDown={(ev) => {
              accept();
            }}
            onClick={(ev) => {}}
          >
            <CheckIcon className="w-3 h-3" />
          </div>
          <div
            className="h-6 w-6 flex-center bg-gray-750 hover:bg-red-700/50 transition-colors rounded-r"
            onMouseDown={(ev) => {
              reject();
            }}
            onClick={(ev) => {}}
          >
            <XMarkIcon className="w-3 h-3" />
          </div>
        </>
      )}
    </div>
  );
}
