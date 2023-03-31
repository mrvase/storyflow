import cl from "clsx";
import { useSortableItem } from "@storyflow/dnd";
import {
  ChevronRightIcon,
  ChevronUpDownIcon,
  ComputerDesktopIcon,
  LockClosedIcon,
  XMarkIcon,
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
import { useIsFocused as useIsEditorFocused } from "../editor/react/useIsFocused";
import { getDefaultField } from "@storyflow/backend/fields";
import { IframeProvider } from "./builder/IframeContext";
import { BuilderPathProvider, useBuilderPath } from "./BuilderPath";
import useTabs from "../layout/useTabs";
import { getConfigFromType, useClientConfig } from "../client-config";
import { isTemplateField } from "@storyflow/backend/ids";
import { FieldToolbarPortal } from "../documents/FieldToolbar";
import { EditorFocusProvider } from "../editor/react/useIsFocused";
import { Attributes, AttributesProvider } from "./Attributes";

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

  return (
    <EditorFocusProvider>
      <AttributesProvider>
        <FieldToolbarPortal show={isFocused} />
        <IframeProvider>
          <BuilderPathProvider>
            <div
              {...props}
              {...handlers}
              className={cl(
                "relative grow shrink basis-0 group/container px-2.5 mt-5",
                isFocused && "focused"
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
              <BuilderPortal id={id}>
                {(isOpen) => (
                  <FieldPage selected={isOpen} id={id}>
                    <div className={cl("relative grow shrink basis-0 p-2.5")}>
                      <div className="flex items-center text-sm gap-2 mb-2.5">
                        <Attributes hideChildrenProps />
                      </div>
                      {children}
                    </div>
                  </FieldPage>
                )}
              </BuilderPortal>
            </div>
          </BuilderPathProvider>
        </IframeProvider>
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

  if (isEditorFocused) {
    ring = "ring-1 bg-gray-50 dark:ring-yellow-200/50 dark:bg-gray-800";
  } else if (isFieldFocused) {
    ring = "ring-1 ring-yellow-200/25";
  } else {
    ring = "ring-1 ring-transparent group-hover/container:ring-gray-800";
  }

  return (
    <div
      className={cl(
        ring,
        "p-2.5 rounded-md ring-1",
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
  const [path, setPath] = useBuilderPath();

  const [isEditing] = [true]; //useLocalStorage<boolean>("editing-articles", false);

  const [, navigateTab] = useTabUrl();
  const { current, full } = useSegment();
  const isOpen = full.endsWith(`/c-${id}`);
  const specialFieldConfig = getDefaultField(id);

  const fullscreen = () => {
    navigateTab(isOpen ? `${current}` : `${current}/c-${id}`);
  };

  return (
    <div className={cl("flex", "h-8 pb-3")} onDoubleClick={fullscreen}>
      <Dot id={id} dragHandleProps={isEditing ? dragHandleProps : {}} />
      <div
        className={cl(
          "ml-5 flex items-center gap-2 text-sm font-normal select-none whitespace-nowrap"
        )}
      >
        <Label
          id={id}
          // isEditable={isNative && isEditing}
        />
        <PathMap />
        <Attributes />
      </div>
      {specialFieldConfig && (
        <div className="ml-3 backdrop:mr-8 text-xs my-0.5 font-light bg-yellow-300 text-yellow-800/90 dark:bg-yellow-400/10 dark:text-yellow-200/75 px-1.5 rounded whitespace-nowrap">
          {specialFieldConfig.label}
        </div>
      )}
      <button
        className={cl(
          "ml-auto shrink-0 text-sm font-light flex-center gap-2 px-2 h-7 -my-1 bg-gray-750 rounded",
          isFocused
            ? "opacity-50"
            : "opacity-0 group-hover/container:opacity-20",
          // "opacity-0 group-hover/container:opacity-50",
          "group-hover/container:hover:opacity-100 transition-opacity"
        )}
        onClick={fullscreen}
      >
        <ComputerDesktopIcon className="w-4 h-4" /> Preview
      </button>
      {path.length > 0 && (
        <button
          className="-my-1 ml-1 -mr-1 w-7 h-7 flex-center"
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
  const [path, setPath] = useBuilderPath();

  const { libraries } = useClientConfig();
  return (
    <>
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
    </>
  );
}

function Dot({ id, dragHandleProps }: { id: FieldId; dragHandleProps: any }) {
  const isNative = !isTemplateField(id);

  const isDraggable = "draggable" in dragHandleProps;

  const [, navigateTab] = useTabUrl();
  const { current, full } = useSegment();
  const isOpen = full.endsWith(`/c-${id}`);

  const Icon = isNative ? ChevronUpDownIcon : LockClosedIcon;

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
      </Draggable>
    </>
  );
}

function Label({ id }: { id: FieldId }) {
  const isNative = !isTemplateField(id);

  const [focused] = useFieldFocus();
  const isLink = focused && focused !== id;
  const label = useLabel(id);

  return (
    <span
      className={cl(
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
