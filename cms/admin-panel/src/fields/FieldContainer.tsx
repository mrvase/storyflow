import cl from "clsx";
import { useSortableItem } from "@storyflow/dnd";
import {
  ArrowsPointingInIcon,
  ArrowsPointingOutIcon,
  ChevronRightIcon,
  LinkIcon,
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
import { isTemplateField, restoreId } from "@storyflow/backend/ids";
import { useFieldConfig, useLabel } from "../state/documentConfig";
import { Computation, FieldConfig, FieldId } from "@storyflow/backend/types";
import { getTranslateDragEffect } from "../utils/dragEffects";
import useIsFocused from "../utils/useIsFocused";
import { Path, PathSegment } from "@storyflow/frontend/types";
import {
  IframeProvider,
  useIframeDispatchers,
  useIframeListeners,
} from "./builder/BuilderIframe";
import { useFieldId } from "./FieldIdContext";
import { useCollab } from "../state/collaboration";
import { PathContext } from "./PathContext";

const useBuilderPath = (): [
  path: Path,
  setPath: (value: Path | ((ps: Path) => Path)) => void
] => {
  const id = useFieldId();

  const [path, setPathInternal] = React.useState<Path>([]);

  const listeners = useIframeListeners();
  const dispatchers = useIframeDispatchers();

  React.useEffect(() => {
    return listeners.selection.subscribe((path) => {
      // check if path is from own field.
      setPathInternal(path);
    });
  }, []);

  const setPath = React.useCallback((value: Path | ((ps: Path) => Path)) => {
    setPathInternal((ps) => (typeof value === "function" ? value(ps) : value));
    // dispatch
  }, []);

  return [path, setPath];
};

type Props = {
  fieldConfig: FieldConfig;
  index: number;
  children: React.ReactNode;
  initialValue: Computation;
  dragHandleProps?: any;
};

export default function FieldContainer(props: Props) {
  return (
    <IframeProvider>
      <FieldContainerInner {...props} />
    </IframeProvider>
  );
}

function FieldContainerInner({
  fieldConfig,
  index,
  children,
  dragHandleProps: dragHandlePropsFromProps,
  initialValue,
}: Props) {
  const props: any = {};

  const dotProps: any = {};

  const [path, setPath] = useBuilderPath();

  const [config, setConfig] = useFieldConfig(fieldConfig.id);

  const ctx = React.useMemo(
    () => ({
      path,
      goToPath: (path: PathSegment | null) =>
        setPath((ps) => (path === null ? [] : [...ps, path])),
    }),
    [path]
  );

  if (!dragHandlePropsFromProps) {
    const {
      dragHandleProps: dragHandlePropsFromHook,
      ref,
      state,
    } = useSortableItem({
      id: fieldConfig.id,
      index,
      item: fieldConfig,
    });

    const style = getTranslateDragEffect(state);

    const { isFocused, handlers } = useIsFocused({
      multiple: true,
      holdShiftKey: true,
      item: fieldConfig,
    });

    Object.assign(dotProps, dragHandlePropsFromHook, handlers, {
      className: isFocused && "bg-yellow-600",
    });

    const dragProps = {
      ref,
      style,
    };

    Object.assign(props, dragProps);
  } else {
    Object.assign(dotProps, dragHandlePropsFromProps);
  }

  const { full } = useSegment();
  const isOpen = full.endsWith(`/c-${restoreId(fieldConfig.id)}`);

  const native =
    (!isTemplateField(fieldConfig.id) || fieldConfig.static) &&
    !Boolean(dragHandlePropsFromProps);

  const content = (withProps: boolean) => (
    <div
      {...(withProps && props)}
      className={cl(
        "relative grow shrink basis-0 focus-container pt-5",
        withProps && props.className
      )}
    >
      <div
        className={cl(
          !isOpen && "focus-bg",
          "-z-10 absolute bg-black/20 inset-0 pointer-events-none"
        )}
      />
      <div className="flex px-5 h-5">
        <Dot id={fieldConfig.id} native={native} {...(withProps && dotProps)} />
        <div className="ml-5 flex">
          {path.length === 0 ? (
            <Label id={fieldConfig.id} native={native} />
          ) : (
            <PathMap path={path} setPath={setPath} />
          )}
        </div>
        {fieldConfig.static && (
          <div className="ml-auto mr-8 text-xs py-0.5 font-light bg-yellow-400/30 text-yellow-200 px-2 rounded-full">
            {fieldConfig.label}
          </div>
        )}
      </div>
      {children}
    </div>
  );

  return (
    <PathContext.Provider value={ctx}>
      {content(true)}
      <BuilderPortal id={fieldConfig.id}>
        {(isOpen) => (
          <FieldPage
            selected={isOpen}
            id={fieldConfig.id}
            initialValue={initialValue}
          >
            {content(false)}
          </FieldPage>
        )}
      </BuilderPortal>
    </PathContext.Provider>
  );
}

function PathMap({
  path,
  setPath,
}: {
  path: Path;
  setPath: (value: Path) => void;
}) {
  return (
    <div className="text-sm font-light text-white/50 flex items-center gap-2 flex-wrap">
      <button
        type="button"
        onClick={() => setPath([])}
        className="hover:underline"
      >
        <LabelText />
      </button>
      {path.map(({ id, label, parentProp }, index) => (
        <React.Fragment key={id}>
          {parentProp !== null && (
            <>
              <div className="opacity-75">·</div>
              <div className="opacity-75">{parentProp.label}</div>
            </>
          )}
          <div className="opacity-75">
            <ChevronRightIcon className="w-3 h-3" />
          </div>
          <button
            type="button"
            onClick={() => setPath(path.slice(0, index + 1))}
            className="hover:underline text-yellow-400"
          >
            {label}
          </button>
        </React.Fragment>
      ))}
    </div>
  );
}

function Dot({ id, native, ...props }: any) {
  const [focused] = useFieldFocus();

  const isEditable = native;

  const isLink = focused && focused !== id;

  const [, navigateTab] = useTabUrl();
  const { current, full } = useSegment();

  const isOpen = full.endsWith(`/c-${restoreId(id)}`);

  const Icon = isOpen ? ArrowsPointingInIcon : ArrowsPointingOutIcon;

  return (
    <>
      <div
        {...props}
        className="group w-6 h-6 p-1 -m-1 translate-y-0.5"
        data-focus-remain="true"
        onClick={() => {
          navigateTab(isOpen ? `${current}` : `${current}/c-${restoreId(id)}`);
        }}
      >
        <div
          className={cl(
            "flex-center w-4 h-4 rounded-full group-hover:scale-[1.5] transition-transform",
            props.className
              ? props.className
              : isOpen
              ? "bg-gray-200 dark:bg-gray-600/50 dark:group-hover:bg-red-800/50"
              : !isEditable
              ? "bg-gray-200 dark:bg-teal-600/50 dark:group-hover:bg-teal-800/50"
              : "bg-gray-200 dark:bg-gray-600/50 dark:group-hover:bg-sky-800/50"
          )}
        >
          <div
            className={cl(
              "flex-center w-2 h-2 m-1 rounded-full group-hover:scale-[2] transition-[transform,background-color]",
              isOpen
                ? "dark:bg-white/20 dark:group-hover:bg-red-800"
                : "dark:bg-white/20 dark:group-hover:bg-sky-800"
            )}
          >
            <Icon className="w-[0.3rem] h-1.5 opacity-0 group-hover:opacity-75 transition-opacity" />
          </div>
        </div>
      </div>
      <button
        className={cl(
          isLink
            ? "opacity-25 hover:opacity-100"
            : "opacity-0 pointer-events-none",
          "absolute z-10 top-7 w-6 h-6 p-1 -mx-1 transition-opacity"
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

function Label({ id, native }: { id: FieldId; native?: boolean }) {
  const label = useLabel(id);
  const isEditable = native;

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
    <span className="text-sm text-teal-400/60 font-normal">{label}</span>
  );
}
