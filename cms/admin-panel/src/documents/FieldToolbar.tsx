import cl from "clsx";
import {
  ArrowDownTrayIcon,
  CheckIcon,
  FunnelIcon,
  ListBulletIcon,
  PencilSquareIcon,
  ScissorsIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { DocumentId, FieldId, RestrictTo } from "@storyflow/backend/types";
import React from "react";
import ReactDOM from "react-dom";
import { DocumentConfigOp, PropertyOp, targetTools } from "shared/operations";
import { useOptimisticDocumentList } from ".";
import { useTemplateFolder } from "../folders/folders-context";
import Content from "../layout/components/Content";
import { useDocumentMutate } from "./collab/DocumentCollabContext";
import { useFieldConfig } from "./collab/hooks";
import { Checkbox } from "../elements/Checkbox";
import { useContextWithError } from "../utils/contextError";
import { useFieldId } from "../fields/FieldIdContext";
import { getDocumentId } from "@storyflow/backend/ids";
import { Range } from "../elements/Range";

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

export function FieldToolbar({ index }: { index?: number }) {
  const fieldId = useFieldId();
  const documentId = getDocumentId(fieldId);

  const [config, setConfig] = useFieldConfig(fieldId);

  const { push } = useDocumentMutate<DocumentConfigOp>(documentId, documentId);

  const templateFolder = useTemplateFolder()?._id;
  const { articles: templates } = useOptimisticDocumentList(templateFolder);

  const templateOptions = (templates ?? []).map((el) => ({
    id: el._id,
    label: el.label ?? el._id,
  }));

  const restrictToOptions = [
    { id: "number" as "number", label: "Tal" },
    { id: "image" as "image", label: "Billede" },
    { id: "color" as "color", label: "Farve" },
  ];

  return (
    <Content.Toolbar>
      <div className="h-6 px-2 flex-center gap-1.5 rounded dark:bg-yellow-400/10 dark:text-yellow-200/75 ring-1 ring-yellow-200/50 text-xs whitespace-nowrap">
        1 valgt
        <XMarkIcon className="w-3 h-3" />
      </div>
      <FieldLabel id={fieldId} label={config?.label ?? ""} />
      <Content.ToolbarMenu<{ id: DocumentId; label: string }>
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
      <Content.ToolbarMenu<{ id: RestrictTo; label: string }>
        icon={FunnelIcon}
        label="Begræns til"
        onSelect={(el) => setConfig("restrictTo", el.id)}
        onClear={() => setConfig("restrictTo", undefined)}
        selected={
          config?.restrictTo
            ? restrictToOptions.find((el) => el.id === config.restrictTo)
            : undefined
        }
        options={restrictToOptions}
      />
      {/* config?.template && (
        <Content.ToolbarMenu
          icon={ArrowDownTrayIcon}
          label="Hent mapper"
          onSelect={(el) => setConfig("restrictTo", el.id)}
          onClear={() => setConfig("restrictTo", undefined)}
          selected={
            config?.restrictTo
              ? restrictToOptions.find((el) => el.id === config.restrictTo)
              : undefined
          }
        >
          // children
        </Content.ToolbarMenu>
      )*/}
      {typeof index === "number" && (
        <Content.ToolbarButton
          data-focus-remain="true"
          onClick={() => {
            push({
              target: targetTools.stringify({
                operation: "document-config",
                location: "",
              }),
              ops: [
                {
                  index,
                  remove: 1,
                },
              ],
            });
          }}
        >
          <TrashIcon className="w-4 h-4" />
        </Content.ToolbarButton>
      )}
    </Content.Toolbar>
  );
}

function FieldLabel({ id, label }: { id: FieldId; label: string }) {
  const articleId = getDocumentId(id);
  const { push } = useDocumentMutate<PropertyOp>(articleId, articleId);

  const onChange = (value: string) => {
    push({
      target: targetTools.stringify({
        operation: "property",
        location: id,
      }),
      ops: [
        {
          name: "label",
          value: value,
        },
      ],
    });
  };
  return <EditableLabel label="Label" value={label} onChange={onChange} />;
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
        " text-xs text-gray-300 font-light flex h-6 ring-1 rounded",
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
