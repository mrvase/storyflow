import cl from "clsx";
import { useSortableItem } from "@storyflow/dnd";
import {
  ChevronRightIcon,
  ChevronUpDownIcon,
  LockClosedIcon,
} from "@heroicons/react/24/outline";
import React from "react";
import { useFieldFocus } from "../field-focus";
import { BuilderPortal } from "./builder/BuilderPortal";
import { addImport } from "../custom-events";
import { FieldPage } from "./FieldPage";
import { useSegment } from "../layout/components/SegmentContext";
import { useTabUrl } from "../layout/utils";
import { useLabel } from "../documents/collab/hooks";
import { FieldConfig, FieldId } from "@storyflow/backend/types";
import { getTranslateDragEffect } from "../utils/dragEffects";
import useIsFocused from "../utils/useIsFocused";
import { Path } from "@storyflow/frontend/types";
import { getDefaultField } from "@storyflow/backend/fields";
import { IframeProvider } from "./builder/IframeContext";
import { useFieldId } from "./FieldIdContext";
import { BuilderPathProvider, useBuilderPath } from "./BuilderPath";
import useTabs from "../layout/useTabs";
import { getConfigFromType, useClientConfig } from "../client-config";
import { isTemplateField } from "@storyflow/backend/ids";
import { FieldToolbarPortal } from "../documents/FieldToolbar";

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
  let props: any = {};
  let dragHandleProps: any;

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
    id: fieldConfig.id,
  });

  return (
    <>
      <FieldToolbarPortal show={isFocused} />
      <IframeProvider>
        <BuilderPathProvider>
          <div
            {...props}
            {...handlers}
            className={cl(
              "relative grow shrink basis-0 group/container",
              isFocused && "focused"
            )}
          >
            <LabelBar
              fieldConfig={fieldConfig}
              dragHandleProps={dragHandleProps}
              isFocused={isFocused}
            />
            {children}
          </div>
          <BuilderPortal id={fieldConfig.id}>
            {(isOpen) => (
              <FieldPage selected={isOpen} id={fieldConfig.id}>
                <div
                  className={cl("pt-5 -mt-2.5 relative grow shrink basis-0")}
                >
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
    </>
  );
}

function LabelBar({
  fieldConfig,
  dragHandleProps,
  isFocused,
}: {
  fieldConfig: FieldConfig;
  dragHandleProps: any;
  isFocused: boolean;
}) {
  const [path, setPath] = useBuilderPath();

  const isNative = !isTemplateField(fieldConfig.id);

  const [isEditing] = [true]; //useLocalStorage<boolean>("editing-articles", false);

  const [, navigateTab] = useTabUrl();
  const { current, full } = useSegment();
  const isOpen = full.endsWith(`/c-${fieldConfig.id}`);
  const [, specialFieldConfig] = getDefaultField(fieldConfig.id);

  const fullscreen = () => {
    navigateTab(isOpen ? `${current}` : `${current}/c-${fieldConfig.id}`);
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
            // isEditable={isNative && isEditing}
          />
        ) : (
          <PathMap path={path} setPath={setPath} />
        )}
      </div>
      {specialFieldConfig && (
        <div className="ml-3 backdrop:mr-8 text-xs my-0.5 font-light bg-yellow-300 text-yellow-800/90 dark:bg-yellow-400/10 dark:text-yellow-200/75 px-1.5 rounded whitespace-nowrap">
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
              : getConfigFromType(el.element, libraries)?.label}
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
  const isOpen = full.endsWith(`/c-${id}`);

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
          const tab = isOpen ? currentUrl : `${currentUrl}/c-${id}`;
          navigateTab(`/~${index}/${tab}`);
        }}
      >
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
              !isEditable
                ? "bg-gray-200 dark:bg-teal-600/50 dark:group-hover:bg-teal-800/50"
                : "bg-gray-200 dark:bg-gray-600/50"
            )}
          >
            <div
              className={cl(
                "flex-center w-2 h-2 m-1 rounded-full group-hover:scale-[2] transition-[transform,background-color]",
                !isEditable && "dark:group-hover:bg-teal-800",
                "dark:bg-white/20"
              )}
            >
              <Icon className="w-[0.3rem] h-1.5 opacity-0 group-hover:opacity-75 transition-opacity" />
            </div>
          </div>
        </div>
      </Draggable>
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

function Label({ id, isNative }: { id: FieldId; isNative?: boolean }) {
  const [focused] = useFieldFocus();
  const isLink = focused && focused !== id;

  const label = useLabel(id);

  /*
  const articleId = getDocumentId(id);

  const { push } = useDocumentCollab().mutate<PropertyOp>(articleId, articleId);

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

  isEditable ? (
    <EditableLabel
      value={label}
      onChange={onChange}
      className="text-sm text-gray-400 placeholder:text-gray-300 dark:placeholder:text-gray-500 font-normal"
    />
  ) : 
  */

  return (
    <span
      className={cl(
        "text-sm font-normal select-none whitespace-nowrap",
        isNative ? "text-gray-400" : "text-teal-600/90 dark:text-teal-400/90",
        isLink ? "cursor-alias" : "cursor-default"
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
