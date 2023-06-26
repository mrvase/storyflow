import cl from "clsx";
import { useDragItem, useSortableItem } from "@storyflow/dnd";
import {
  ChevronRightIcon,
  ChevronUpDownIcon,
  EllipsisHorizontalIcon,
  EyeIcon,
  EyeSlashIcon,
  LinkIcon,
  LockClosedIcon,
  TrashIcon,
  WindowIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import React from "react";
import { useFieldFocus } from "../FieldFocusContext";
import { addImport } from "../custom-events";
import { useFieldConfig, useLabel } from "../documents/document-config";
import type {
  DocumentId,
  FieldId,
  NestedDocumentId,
} from "@storyflow/shared/types";
import type { FieldConfig } from "@storyflow/cms/types";
import { getTranslateDragEffect } from "../utils/dragEffects";
import useIsFocused from "../utils/useIsFocused";
import { useIsFocused as useIsEditorFocused } from "../editor/react/useIsFocused";
import { getDefaultField, isDefaultField } from "@storyflow/cms/default-fields";
import { getConfigFromType, useAppConfig } from "../AppConfigContext";
import { getDocumentId, isTemplateField } from "@storyflow/cms/ids";
import { FieldToolbar } from "../documents/FieldToolbar";
import { EditorFocusProvider } from "../editor/react/useIsFocused";
import { Attributes, AttributesProvider } from "./Attributes";
import { SelectedPathProvider, useNestedEntity, useSelectedPath } from "./Path";
import { useLocalStorage } from "../state/useLocalStorage";
import { useFieldRestriction } from "./FieldIdContext";
import { useFolder } from "../folders/FoldersContext";
import { useNavigate, usePath, useRoute } from "@nanokit/router";
import { EditableLabel } from "../elements/EditableLabel";
import { usePush } from "../collab/CollabContext";
import { DocumentTransactionEntry } from "../operations/actions";
import { createTransaction } from "@storyflow/collab/utils";
import { useTranslation } from "../translation/TranslationContext";
import { InlineButton } from "../elements/InlineButton";
import { Menu } from "../elements/Menu";
import { useTopFieldIndex } from "../documents/FieldIndexContext";
import { useDialog } from "../elements/Dialog";
import { useTemplatePath } from "../documents/TemplatePathContext";
import { DragIcon } from "../elements/DragIcon";

type Props = {
  fieldConfig: FieldConfig;
  index: number;
  children: React.ReactNode;
  dragHandleProps?: any;
};

export function FieldContainer(props: Props) {
  return (
    <EditorFocusProvider>
      <AttributesProvider>
        <SelectedPathProvider id={props.fieldConfig.id}>
          <ContainerDiv {...props} />
        </SelectedPathProvider>
      </AttributesProvider>
    </EditorFocusProvider>
  );
}

function ContainerDiv({
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
    // id,
  });

  return (
    <VisibilityHandler fieldId={id}>
      <div
        {...props}
        {...handlers}
        className={cl(
          "relative grow shrink basis-0 group/container p-2.5",
          "bg-white dark:bg-gray-900 rounded"
        )}
      >
        <LabelBar
          id={id}
          dragHandleProps={dragHandleProps}
          isFocused={isFocused}
        />
        <div className="pl-[3.125rem] pr-2.5 pb-2.5">{children}</div>
      </div>
    </VisibilityHandler>
  );
}

function VisibilityHandler({
  fieldId,
  children,
}: {
  fieldId: FieldId;
  children: React.ReactElement;
}) {
  const [isOpen] = useLocalStorage<boolean>("toolbar-open", true);
  const [config] = useFieldConfig(fieldId);
  const show = isOpen || !config?.hidden;

  return React.cloneElement(children, {
    className: cl(children.props.className, show ? "" : "hidden"),
  });
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

  ring = "ring-transparent";

  /*
  if (isOpen) {
    if (isEditorFocused) {
      ring = "ring-transparent";
      // ring = isOpen ? " dark:ring-yellow-200/60" : " dark:ring-gray-600";
    } else if (isFieldFocused) {
      ring = "ring-yellow-200/40";
    } else {
      ring = "ring-transparent group-hover/container:ring-gray-700/50";
    }
  }
  */

  return (
    <div
      className={cl(
        ring,
        "relative pb-0 rounded ring-1",
        "transition-[background-color,box-shadow]"
      )}
    >
      {children}
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

  const [isOpen] = useLocalStorage<boolean>("toolbar-open", true);

  const specialFieldConfig = getDefaultField(id);

  const templatePath = useTemplatePath();

  const isNative = Boolean(
    !isTemplateField(id) || (specialFieldConfig && templatePath.length === 2)
  );

  return (
    <div
      className={cl(
        "flex items-center sticky top-0",
        isFocused ? "z-30" : "z-20",
        "h-11 p-2.5 rounded bg-white dark:bg-gray-900" /* -translate-y-2.5 */
      )}
    >
      <Dot
        id={id}
        isNative={isNative}
        dragHandleProps={isOpen ? dragHandleProps : undefined}
      />
      <div
        className={cl(
          "ml-5 mr-auto flex items-center gap-3 text-sm select-none whitespace-nowrap"
        )}
      >
        <Label id={id} isNative={isNative} />
        <HiddenIcon fieldId={id} />
        <PathMap />
        <Attributes />
        <PreviewButton id={id} />
      </div>
      <div className="flex items-center gap-3">
        {specialFieldConfig && (
          <div
            className={cl(
              "text-sm font-medium text-teal-600 bg-teal-100 rounded px-1.5 py-0.5 dark:text-teal-400 dark:bg-teal-950"
            )}
          >
            {specialFieldConfig.label}
          </div>
        )}
        {!specialFieldConfig && isNative && <FieldToolbar fieldId={id} />}
        <ReferenceButton id={id} />
        <FieldMenu fieldId={id} isNative={isNative} />
      </div>
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

function HiddenIcon({ fieldId }: { fieldId: FieldId }) {
  const [config] = useFieldConfig(fieldId);

  if (config?.hidden) {
    return (
      <span>
        <EyeSlashIcon className="w-5 h-5" />
      </span>
    );
  }
  return null;
}

function FieldMenu({
  fieldId,
  isNative,
}: {
  fieldId: FieldId;
  isNative: boolean;
}) {
  const t = useTranslation();

  const index = useTopFieldIndex();

  const documentId = getDocumentId<DocumentId>(fieldId);
  const push = usePush<DocumentTransactionEntry>(documentId, "config");

  const { wrapInDialog, open } = useDialog({
    title: "Slet felt",
    description: "Er du sikker på at du vil slette feltet?",
  });

  const [config, setConfig] = useFieldConfig(fieldId);

  return (
    <>
      {typeof index === "number" &&
        wrapInDialog(
          <button
            onClick={() => {
              push([["", [[index, 1]]]]);
            }}
          >
            slet
          </button>
        )}
      <Menu as={InlineButton} icon={EllipsisHorizontalIcon} align="right">
        {typeof index === "number" && (
          <Menu.Item
            label={t.general[config?.hidden ? "show" : "hide"]()}
            icon={EyeIcon}
            onClick={() => setConfig("hidden", (value) => !value)}
          />
        )}
        <Menu.Item
          label={`${t.fields.deleteFields({ count: 1 })}...`}
          icon={TrashIcon}
          onClick={open}
        />
      </Menu>
    </>
  );
}

function ReferenceButton({ id }: { id: FieldId }) {
  const [focused] = useFieldFocus();
  const isLink = focused && focused !== id;

  if (!isLink) return null;
  return (
    <InlineButton
      onMouseDown={(ev) => {
        if (isLink) {
          ev.preventDefault();
          ev.stopPropagation();
          addImport.dispatch({ id, imports: [] });
        }
      }}
      icon={LinkIcon}
      color="teal"
    >
      Referer
    </InlineButton>
  );
}

function PreviewButton({ id }: { id: FieldId }) {
  const route = useRoute();
  const { pathname } = usePath();
  const navigate = useNavigate();

  const isOpen = pathname.endsWith(`/c/${id}`);

  const to = isOpen ? route.accumulated : `${route.accumulated}/c/${id}`;

  const fullscreen = () => {
    navigate(to, {
      navigate: true,
    });
  };

  const { index: panelIndex } = useRoute("parallel");

  const restrictTo = useFieldRestriction();

  const { dragHandleProps: linkDragHandleProps } = useDragItem({
    type: `link:${panelIndex}`,
    item: to,
    mode: "link",
  });

  if (
    !isDefaultField(id, "layout") &&
    !isDefaultField(id, "page") &&
    restrictTo !== "children"
  ) {
    return null;
  }

  return (
    <InlineButton
      onClick={fullscreen}
      {...linkDragHandleProps}
      icon={WindowIcon}
    >
      Åbn preview
    </InlineButton>
  );
}

export function PathMap() {
  const [{ selectedPath }] = useSelectedPath();

  const selectedElements = selectedPath.reduce(
    (a: [FieldId, NestedDocumentId][], c, i) => {
      if (i % 2 === 0) {
        a.push([c, undefined] as unknown as [FieldId, NestedDocumentId]);
      } else {
        a[a.length - 1][1] = c as NestedDocumentId;
      }
      return a;
    },
    []
  );

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

  const { configs } = useAppConfig();

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
    const config = getConfigFromType(entity.element, configs);

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

function Dot({
  id,
  isNative,
  dragHandleProps,
}: {
  id: FieldId;
  isNative: boolean;
  dragHandleProps: any;
}) {
  const Icon = isNative ? ChevronUpDownIcon : LockClosedIcon;

  if (dragHandleProps) {
    return (
      <div className="w-7 h-7 p-1 -mx-1 cursor-grab" {...dragHandleProps}>
        <DragIcon className="w-5 h-5" />
      </div>
    );
  }

  return (
    <>
      <div
        {...dragHandleProps}
        className={cl(
          "group w-7 h-7 p-1 -mx-1 -my-0.5",
          dragHandleProps && "cursor-grab"
        )}
      >
        <div
          className={cl(
            "flex-center w-5 h-5 rounded-full group-hover:scale-[1.5] transition-transform",
            !isNative
              ? "bg-teal-500/60 dark:bg-teal-800"
              : "bg-gray-200 dark:bg-gray-600/50"
          )}
        >
          <div
            className={cl(
              "flex-center w-2.5 h-2.5 m-1 rounded-full group-hover:scale-[2] transition-[transform,background-color]",
              "bg-white/20"
            )}
          >
            <Icon className="w-[0.3rem] h-1.5 opacity-0 group-hover:opacity-75 transition-opacity" />
          </div>
        </div>
      </div>
    </>
  );
}

function Label({ id, isNative }: { id: FieldId; isNative: boolean }) {
  const t = useTranslation();

  const [{ selectedPath }, setPath] = useSelectedPath();

  const label = useLabel(id);

  const documentId = getDocumentId<DocumentId>(id);
  const push = usePush<DocumentTransactionEntry>(documentId, "config");

  const onChange = (value: string) => {
    push(
      createTransaction((t) => t.target(id).toggle({ name: "label", value }))
    );
  };

  return (
    <div
      className={cl(
        "flex items-center gap-1 px-1.5 -mx-1.5 font-medium",
        isNative
          ? "text-gray-600 dark:text-gray-400"
          : "text-teal-600 dark:text-teal-400/90",
        "cursor-default",
        selectedPath.length && "hover:underline"
      )}
      onClick={() => {
        setPath([]);
      }}
    >
      <EditableLabel value={label} onChange={onChange} />
    </div>
  );
}
