import cl from "clsx";
import { useDragItem, useSortableItem } from "@storyflow/dnd";
import {
  ChevronRightIcon,
  ChevronUpDownIcon,
  ComputerDesktopIcon,
  LinkIcon,
  LockClosedIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import React from "react";
import { useFieldFocus } from "../field-focus";
import { addImport } from "../custom-events";
import { useLabel } from "../documents/collab/hooks";
import {
  FieldConfig,
  FieldId,
  NestedDocumentId,
} from "@storyflow/backend/types";
import { getTranslateDragEffect } from "../utils/dragEffects";
import useIsFocused from "../utils/useIsFocused";
import { useIsFocused as useIsEditorFocused } from "../editor/react/useIsFocused";
import { getDefaultField, isDefaultField } from "@storyflow/backend/fields";
import { getConfigFromType, useClientConfig } from "../client-config";
import { isTemplateField } from "@storyflow/backend/ids";
import { FieldToolbarPortal } from "../documents/FieldToolbar";
import { EditorFocusProvider } from "../editor/react/useIsFocused";
import { Attributes, AttributesProvider } from "./Attributes";
import { SelectedPathProvider, useNestedEntity, useSelectedPath } from "./Path";
import { useFolder } from "../folders/collab/hooks";
import { usePanel, useRoute } from "../panel-router/Routes";
import { usePanelActions } from "../panel-router/PanelRouter";
import { useLocalStorage } from "../state/useLocalStorage";
import { useFieldRestriction } from "./FieldIdContext";

type Props = {
  fieldConfig: FieldConfig;
  index: number;
  children: React.ReactNode;
  dragHandleProps?: any;
};

export function FieldContainer({
  children,
  index,
  fieldConfig,
  dragHandleProps: dragHandlePropsFromProps,
}: Props) {
  const id = fieldConfig.id;

  let props: any = {};
  let dragHandleProps: any;

  if (!dragHandlePropsFromProps) {
    const {
      dragHandleProps: dragHandlePropsFromHook,
      ref,
      state,
    } = useSortableItem({
      id,
      index: index,
      item: fieldConfig,
    });

    const style = getTranslateDragEffect(state);

    const dragProps = {
      ref,
      style,
    };

    Object.assign(props, dragProps);

    dragHandleProps = dragHandlePropsFromHook;
  } else {
    dragHandleProps = dragHandlePropsFromProps;
  }

  const { isFocused, handlers } = useIsFocused({
    multiple: true,
    id,
  });

  const [isOpen] = useLocalStorage<boolean>("toolbar-open", true);

  return (
    <EditorFocusProvider>
      <AttributesProvider>
        <SelectedPathProvider id={id}>
          <FieldToolbarPortal show={isFocused} />
          <div
            {...props}
            {...(isOpen ? handlers : {})}
            className={cl(
              "relative grow shrink basis-0 group/container px-2.5 mt-5"
            )}
          >
            <FocusContainer isFocused={isFocused}>
              <LabelBar
                id={id}
                dragHandleProps={dragHandleProps}
                isFocused={isFocused}
              />
              <div className="pl-9">{children}</div>
            </FocusContainer>
          </div>
        </SelectedPathProvider>
      </AttributesProvider>
    </EditorFocusProvider>
  );
}

function FocusContainer({
  children,
  isFocused: isFieldFocused,
}: {
  children: React.ReactNode;
  isFocused: boolean;
}) {
  const isEditorFocused = useIsEditorFocused();

  let ring = "";

  const [isOpen] = useLocalStorage<boolean>("toolbar-open", true);

  if (isEditorFocused) {
    ring = "ring-1"; // bg-gray-50 dark:bg-gray-800
    ring += isOpen ? " dark:ring-yellow-200/60" : " dark:ring-gray-600";
  } else if (isFieldFocused) {
    ring = "ring-1 ring-yellow-200/40";
  } else {
    ring = "ring-1 ring-transparent group-hover/container:ring-gray-700/50";
  }

  return (
    <div
      className={cl(
        ring,
        "relative p-2.5 pb-0 rounded ring-1",
        "transition-[background-color,box-shadow]"
      )}
    >
      {children}
    </div>
  );

  return (
    <div
      className={cl(
        ring,
        "relative ml-2.5 mt-2.5 pb-2.5 pr-2.5 rounded rounded-tl-none ring-1",
        "transition-[background-color,box-shadow]"
      )}
    >
      <div className="absolute -top-[1px] -left-[1px] w-3 h-3 border-t border-l border-gray-850" />
      <div className="-translate-x-2">{children}</div>
    </div>
  );
}

function LabelBar({
  id,
  dragHandleProps,
  isFocused,
}: {
  id: FieldId;
  dragHandleProps: any;
  isFocused: boolean;
}) {
  const [{ selectedDocument }, setPath] = useSelectedPath();

  const [isEditing] = [true]; //useLocalStorage<boolean>("editing-articles", false);

  const [{ path, index: panelIndex }, navigate] = usePanel();
  const route = useRoute();

  const isOpen = path.endsWith(`/c${id}`);

  const specialFieldConfig = getDefaultField(id);

  const to = isOpen ? route : `${route}/c${id}`;

  const fullscreen = () => {
    navigate(to, {
      navigate: true,
    });
  };

  const { dragHandleProps: linkDragHandleProps } = useDragItem({
    type: `link:${panelIndex}`,
    item: to,
    mode: "link",
  });

  const restrictTo = useFieldRestriction();

  return (
    <div
      className={cl("flex", "h-8 pb-3" /* -translate-y-2.5 */)}
      // onDoubleClick={fullscreen}
    >
      <Dot id={id} dragHandleProps={isEditing ? dragHandleProps : {}} />
      <div
        className={cl(
          "ml-5 mr-auto flex items-center gap-2 text-sm font-normal select-none whitespace-nowrap"
        )}
      >
        <Label id={id} />
        <PathMap />
        <Attributes />
        {(isDefaultField(id, "layout") ||
          isDefaultField(id, "page") ||
          restrictTo === "children") && (
          <button
            className="rounded-full px-2 py-0.5 text-xs ring-button text-gray-500 ml-1 mr-3 flex-center gap-1"
            onClick={fullscreen}
            {...linkDragHandleProps}
          >
            <ComputerDesktopIcon className="w-3 h-3" /> Åbn preview
          </button>
        )}
      </div>
      {specialFieldConfig && (
        <div
          className={cl(
            "flex-center text-xs h-6 -my-0.5 bg-yellow-300 text-yellow-800/90 dark:bg-yellow-400/10 dark:text-yellow-200/75 px-1.5 rounded whitespace-nowrap",
            isFocused
              ? "opacity-100"
              : "opacity-0 group-hover/container:opacity-80",
            "transition-opacity"
          )}
        >
          {specialFieldConfig.label}
        </div>
      )}
      {/*<button
        className={cl(
          "ml-2 shrink-0 text-xs flex-center gap-2 px-2 h-6 -my-0.5 bg-white/10 rounded",
          isFocused
            ? "opacity-50"
            : "opacity-0 group-hover/container:opacity-20",
          "group-hover/container:hover:opacity-100 transition-opacity"
        )}
        onClick={fullscreen}
      >
        <ComputerDesktopIcon className="w-3 h-3" /> Se preview
      </button>*/}
      {selectedDocument && (
        <button
          className="-my-1 ml-1 -mr-1 w-7 h-7 flex-center shrink-0"
          onClick={() => {
            setPath([]);
          }}
        >
          <XMarkIcon className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

export function PathMap() {
  const [{ selectedPath }] = useSelectedPath();

  const selectedElements = selectedPath.reduce((a, c, i) => {
    if (i % 2 === 0) {
      a.push([c, undefined] as unknown as [FieldId, NestedDocumentId]);
    } else {
      a[a.length - 1][1] = c as NestedDocumentId;
    }
    return a;
  }, [] as [FieldId, NestedDocumentId][]);

  return (
    <>
      {selectedElements.map(([fieldId, documentId]) => (
        <React.Fragment key={documentId}>
          <div className="opacity-75">
            <ChevronRightIcon className="w-3 h-3" />
          </div>
          <ElementLabel fieldId={fieldId} documentId={documentId} />
        </React.Fragment>
      ))}
    </>
  );
}

function ElementLabel(props: {
  fieldId: FieldId;
  documentId: NestedDocumentId;
}) {
  const [, setPath] = useSelectedPath();
  const entity = useNestedEntity(props);

  const { libraries } = useClientConfig();

  if (!entity) {
    return null;
  }

  if ("folder" in entity) {
    const folder = useFolder(entity.folder);

    return (
      <button
        type="button"
        onClick={() =>
          setPath((ps) => {
            const index = ps.findIndex((el) => el === props.documentId);
            if (index < 0) {
              return ps;
            }
            return ps.slice(0, index + 1);
          })
        }
        className="hover:underline text-yellow-400 flex items-center font-medium"
      >
        {folder.label ?? "no"}
      </button>
    );
  }

  if ("element" in entity) {
    const config = getConfigFromType(entity.element, libraries);

    return (
      <button
        type="button"
        onClick={() =>
          setPath((ps) => {
            const index = ps.findIndex((el) => el === props.documentId);
            if (index < 0) {
              return ps;
            }
            return ps.slice(0, index + 1);
          })
        }
        className="hover:underline text-yellow-400 flex items-center font-medium"
      >
        {config?.label ?? "no"}
      </button>
    );
  }

  return null;
}

function Dot({ id, dragHandleProps }: { id: FieldId; dragHandleProps: any }) {
  const isNative = !isTemplateField(id);

  const isDraggable = "draggable" in dragHandleProps;

  const Icon = isNative ? ChevronUpDownIcon : LockClosedIcon;

  return (
    <>
      <div
        {...dragHandleProps}
        className={cl(
          "group w-6 h-6 p-1 -m-1 translate-y-0.5",
          isDraggable && "cursor-grab"
        )}
      >
        <div
          className={cl(
            "flex-center w-4 h-4 rounded-full group-hover:scale-[1.5] transition-transform",
            !isNative
              ? "bg-gray-200 dark:bg-teal-600/50 dark:group-hover:bg-teal-800/50"
              : "bg-gray-200 dark:bg-gray-600/50"
          )}
        >
          <div
            className={cl(
              "flex-center w-2 h-2 m-1 rounded-full group-hover:scale-[2] transition-[transform,background-color]",
              !isNative && "dark:group-hover:bg-teal-800",
              "dark:bg-white/20"
            )}
          >
            <Icon className="w-[0.3rem] h-1.5 opacity-0 group-hover:opacity-75 transition-opacity" />
          </div>
        </div>
      </div>
    </>
  );
}

function Label({ id }: { id: FieldId }) {
  const [{ selectedPath }, setPath] = useSelectedPath();
  const isNative = !isTemplateField(id);

  const [focused] = useFieldFocus();
  const isLink = focused && focused !== id;
  const label = useLabel(id);

  return (
    <div
      className={cl(
        "flex items-center gap-1 bg-gray-850 px-1.5 -ml-1.5 font-medium",
        isNative ? "text-gray-400" : "text-teal-600/90 dark:text-teal-400/90",
        isLink ? "cursor-alias" : "cursor-default",
        selectedPath.length && "hover:underline"
      )}
      onMouseDown={(ev) => {
        if (isLink) {
          ev.preventDefault();
          ev.stopPropagation();
          addImport.dispatch({ id, imports: [] });
        }
      }}
      onClick={() => {
        if (!isLink && selectedPath.length) {
          setPath([]);
        }
      }}
    >
      {label || "Ingen label"}
      {isLink && <LinkIcon className="w-3 h-3 opacity-50" />}
    </div>
  );
}
