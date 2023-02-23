import cl from "clsx";
import { useSortableItem } from "@storyflow/dnd";
import {
  ArrowsPointingInIcon,
  ArrowsPointingOutIcon,
  ChevronRightIcon,
  ChevronUpDownIcon,
  LinkIcon,
  LockClosedIcon,
} from "@heroicons/react/24/outline";
import React from "react";
import { useFieldFocus } from "../field-focus";
import { BuilderPortal } from "./builder/BuilderPortal";
import { EditableLabel } from "../elements/EditableLabel";
import { addImport } from "../custom-events";
import { FieldPage } from "./FieldPage";
import { useSegment } from "../layout/components/SegmentContext";
import { useTabUrl } from "../layout/utils";
import { PropertyOp, targetTools } from "shared/operations";
import { restoreId } from "@storyflow/backend/ids";
import { useLabel } from "../state/documentConfig";
import {
  Computation,
  DocumentId,
  FieldConfig,
  FieldId,
} from "@storyflow/backend/types";
import { getTranslateDragEffect } from "../utils/dragEffects";
import useIsFocused from "../utils/useIsFocused";
import { Path } from "@storyflow/frontend/types";
import { getDefaultField } from "@storyflow/backend/fields";
import { IframeProvider } from "./builder/BuilderIframe";
import { useFieldId } from "./FieldIdContext";
import { useCollab } from "../state/collaboration";
import { BuilderPathProvider, useBuilderPath } from "./BuilderPath";
import { useArticlePageContext } from "../articles/ArticlePageContext";
import { useLocalStorage } from "../state/useLocalStorage";
import useTabs from "../layout/useTabs";
import { getConfigFromType, useClientConfig } from "../client-config";

type Props = {
  fieldConfig: FieldConfig;
  index: number;
  children: React.ReactNode;
  initialValue: Computation;
  template: DocumentId;
  dragHandleProps?: any;
};

export function FieldContainer({
  children,
  initialValue,
  index,
  fieldConfig,
  template,
  dragHandleProps: dragHandlePropsFromProps,
}: Props) {
  let props: any = {};
  let dragHandleProps: any;

  let isFocused = false;

  if (!dragHandlePropsFromProps) {
    const {
      dragHandleProps: dragHandlePropsFromHook,
      ref,
      state,
    } = useSortableItem({
      id: fieldConfig.id,
      index: index,
      item: fieldConfig,
    });

    const style = getTranslateDragEffect(state);

    const { isFocused: isFocused_, handlers } = useIsFocused({
      multiple: true,
      id: fieldConfig.id,
    });

    isFocused = isFocused_;

    const dragProps = {
      ref,
      style,
    };

    Object.assign(props, dragProps, handlers);

    dragHandleProps = dragHandlePropsFromHook;
  } else {
    // dragHandleProps = dragHandlePropsFromProps;
  }

  return (
    <IframeProvider>
      <BuilderPathProvider>
        <div
          {...props}
          className={cl(
            "relative grow shrink basis-0 group/container",
            isFocused && "focused"
          )}
        >
          <LabelBar
            fieldConfig={fieldConfig}
            template={template}
            dragHandleProps={dragHandleProps}
            isFocused={isFocused}
          />
          {children}
        </div>
        <BuilderPortal id={fieldConfig.id}>
          {(isOpen) => (
            <FieldPage
              selected={isOpen}
              id={fieldConfig.id}
              initialValue={initialValue}
            >
              <div className={cl("pt-5 -mt-2.5 relative grow shrink basis-0")}>
                {/*<div
                className={cl(
                  "-z-10 absolute inset-2.5 top-0 rounded-lg pointer-events-none",
                  "bg-gray-850"
                  // "ring-1 ring-inset ring-gray-750"
                )}
                />*/}
                {children}
              </div>
            </FieldPage>
          )}
        </BuilderPortal>
      </BuilderPathProvider>
    </IframeProvider>
  );
}

function LabelBar({
  fieldConfig,
  dragHandleProps,
  template,
  isFocused,
}: {
  fieldConfig: FieldConfig;
  dragHandleProps: any;
  template: DocumentId;
  isFocused: boolean;
}) {
  const [path, setPath] = useBuilderPath();

  const articleId = useArticlePageContext().id;
  const isNative = template === articleId;

  const [isEditing] = useLocalStorage<boolean>("editing-articles", false);

  const [, navigateTab] = useTabUrl();
  const { current, full } = useSegment();
  const isOpen = full.endsWith(`/c-${restoreId(fieldConfig.id)}`);
  const [, specialFieldConfig] = getDefaultField(fieldConfig.id);

  const fullscreen = () => {
    navigateTab(
      isOpen ? `${current}` : `${current}/c-${restoreId(fieldConfig.id)}`
    );
  };

  return (
    <div
      className={cl(
        "flex px-5 pt-5",
        path.length === 0 ? "h-12 pb-2" : "h-[3.75rem] pb-5"
      )}
      onDoubleClick={fullscreen}
    >
      <Dot
        id={fieldConfig.id}
        isNative={isNative}
        dragHandleProps={isEditing ? dragHandleProps : {}}
      />
      <div className={cl("ml-5 flex")}>
        {path.length === 0 ? (
          <Label
            id={fieldConfig.id}
            isNative={isNative}
            template={template}
            isEditable={isNative && isEditing}
          />
        ) : (
          <PathMap path={path} setPath={setPath} />
        )}
      </div>
      {specialFieldConfig && (
        <div className="ml-3 backdrop:mr-8 text-xs my-0.5 font-light bg-yellow-300 text-yellow-800/90 dark:bg-yellow-400/10 dark:text-yellow-200/75 px-1.5 rounded">
          {specialFieldConfig.label}
        </div>
      )}
      <button
        className={cl(
          "ml-auto shrink-0 text-sm font-light flex-center -m-0.5 p-0.5 w-5 h-5 bg-gray-750 rounded-full",
          isFocused
            ? "opacity-75"
            : "opacity-0 group-hover/container:opacity-50",
          // "opacity-0 group-hover/container:opacity-50",
          "group-hover/container:hover:opacity-100 transition-opacity"
        )}
        onClick={fullscreen}
      >
        <ChevronUpDownIcon className="w-4 h-4 rotate-45" />
      </button>
    </div>
  );
}

export function PathMap({
  path,
  setPath,
}: {
  path: Path;
  setPath: (value: Path) => void;
}) {
  const { libraries } = useClientConfig();
  return (
    <div className="text-sm font-light text-white/50 flex items-center gap-2 flex-wrap">
      <button
        type="button"
        onClick={() => setPath([])}
        className="hover:underline"
      >
        <LabelText />
      </button>
      {path.map((el, index) => (
        <React.Fragment key={el.id}>
          <div className="opacity-75">
            <ChevronRightIcon className="w-3 h-3" />
          </div>
          <button
            type="button"
            onClick={() => setPath(path.slice(0, index + 1))}
            className="hover:underline text-yellow-400 flexitems-center"
          >
            {el && "label" in el
              ? el.label
              : getConfigFromType(el.type, libraries)?.label}
          </button>
        </React.Fragment>
      ))}
    </div>
  );
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
  const [focused] = useFieldFocus();
  const isLink = focused && focused !== id;

  const isEditable = isNative;
  const isDraggable = "draggable" in dragHandleProps;

  const [, navigateTab] = useTabUrl();
  const { current, full } = useSegment();
  const isOpen = full.endsWith(`/c-${restoreId(id)}`);

  /*
  const Icon = isOpen
    ? ArrowsPointingInIcon
    : isEditable && isDraggable
    ? ChevronUpDownIcon
    : ArrowsPointingOutIcon;
  */

  const Icon = isEditable ? ChevronUpDownIcon : LockClosedIcon;

  const { tabs } = useTabs();

  return (
    <>
      <Draggable
        onDrop={() => {
          const index = Math.max(...tabs.map((el) => el.index)) + 1;
          const currentUrl = current.split("/").slice(2).join("/");
          const tab = isOpen ? currentUrl : `${currentUrl}/c-${restoreId(id)}`;
          navigateTab(`/~${index}/${tab}`);
        }}
      >
        <div
          {...dragHandleProps}
          className="group w-6 h-6 p-1 -m-1 translate-y-0.5"
          /*
          onClick={() => {
            navigateTab(
              isOpen ? `${current}` : `${current}/c-${restoreId(id)}`
            );
          }}
          */
        >
          <div
            className={cl(
              "flex-center w-4 h-4 rounded-full group-hover:scale-[1.5] transition-transform",
              !isEditable
                ? "bg-gray-200 dark:bg-teal-600/50 dark:group-hover:bg-teal-800/50"
                : "bg-gray-200 dark:bg-gray-600/50"
              /*
              isOpen
                ? "bg-gray-200 dark:bg-gray-600/50 dark:group-hover:bg-red-800/50"
                : !isEditable
                ? "bg-gray-200 dark:bg-teal-600/50 dark:group-hover:bg-teal-800/50"
                : isDraggable
                ? "bg-gray-200 dark:bg-gray-600/50"
                : "bg-gray-200 dark:bg-gray-600/50 dark:group-hover:bg-sky-800/50"
              */
            )}
          >
            <div
              className={cl(
                "flex-center w-2 h-2 m-1 rounded-full group-hover:scale-[2] transition-[transform,background-color]",
                !isEditable && "dark:group-hover:bg-teal-800",
                "dark:bg-white/20"
                /*
                isOpen
                  ? "dark:bg-white/20 dark:group-hover:bg-red-800"
                  : isDraggable && isEditable
                  ? "dark:bg-white/20"
                  : "dark:bg-white/20 dark:group-hover:bg-sky-800"
                */
              )}
            >
              <Icon className="w-[0.3rem] h-1.5 opacity-0 group-hover:opacity-75 transition-opacity" />
            </div>
          </div>
        </div>
      </Draggable>
      {/*
      <button
        tabIndex={-1}
        className={cl(
          isLink
            ? "opacity-25 hover:opacity-100"
            : "opacity-0 pointer-events-none",
          "absolute z-10 top-11 w-6 h-6 p-1 -mx-1 transition-opacity duration-75"
        )}
        onMouseDown={(ev) => {
          if (isLink) {
            ev.preventDefault();
            ev.stopPropagation();
            addImport.dispatch({ id, imports: [] });
          }
        }}
      >
        <LinkIcon className="w-4 h-4" />
      </button>
      */}
    </>
  );
}

function LabelText() {
  const id = useFieldId();
  const label = useLabel(id);
  return (
    <span className="text-sm text-gray-400 font-normal">{label || "Top"}</span>
  );
}

function Label({
  id,
  isNative,
  isEditable,
  template,
}: {
  id: FieldId;
  isNative?: boolean;
  isEditable?: boolean;
  template: DocumentId;
}) {
  const [focused] = useFieldFocus();
  const isLink = focused && focused !== id;

  const label = useLabel(id, template);

  const articleId = id.slice(0, 4);

  const { push } = useCollab().mutate<PropertyOp>(articleId, articleId);

  const onChange = (value: string) => {
    push({
      target: targetTools.stringify({
        field: "any",
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

  return isEditable ? (
    <EditableLabel
      value={label}
      onChange={onChange}
      className="text-sm text-gray-400 placeholder:text-gray-300 dark:placeholder:text-gray-500 font-normal"
    />
  ) : (
    <span
      className={cl(
        "text-sm font-normal",
        isNative ? "text-gray-400" : "text-teal-600/90 dark:text-teal-400/90",
        isLink && "cursor-alias"
      )}
      onMouseDown={(ev) => {
        if (isLink) {
          ev.preventDefault();
          ev.stopPropagation();
          addImport.dispatch({ id, imports: [] });
        }
      }}
    >
      {label || "Ingen label"}
    </span>
  );
}

function Draggable({
  children,
  onDrop,
}: {
  children: React.ReactNode;
  onDrop: () => void;
}) {
  const [start, setStart] = React.useState(0);
  const [x, setX] = React.useState(0);
  const [isDragging, setIsDragging] = React.useState(false);

  React.useEffect(() => {
    if (isDragging) {
      const handleMove = (ev: DragEvent) => {
        ev.preventDefault();
        setX(ev.clientX - start);
      };

      window.addEventListener("dragover", handleMove);
      return () => {
        window.removeEventListener("dragover", handleMove);
      };
    }
  }, [isDragging, start]);

  const accepted = Math.abs(x) >= 20;

  React.useEffect(() => {
    if (isDragging) {
      const handleDrop = (ev: DragEvent) => {
        ev.preventDefault();
        if (accepted) {
          onDrop();
        }
      };

      window.addEventListener("drop", handleDrop);
      return () => {
        window.removeEventListener("drop", handleDrop);
      };
    }
  }, [isDragging, accepted]);

  const dragImage = React.useRef<HTMLSpanElement | null>(null);

  const onDragStart = React.useCallback((ev: React.DragEvent) => {
    ev.dataTransfer.setDragImage(dragImage.current!, 0, 0);
    setStart(ev.clientX);
    setIsDragging(true);
  }, []);

  const onDragEnd = React.useCallback((ev: React.DragEvent) => {
    ev.preventDefault();
    setIsDragging(false);
    setX(0);
    setStart(0);
  }, []);

  return (
    <div
      draggable="true"
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      style={{ transform: `translateX(${Math.min(Math.max(x, -20), 20)}px)` }}
    >
      <span
        ref={dragImage}
        className="absolute block w-1 h-1 pointer-events-none opacity-0"
      ></span>
      {children}
    </div>
  );
}
