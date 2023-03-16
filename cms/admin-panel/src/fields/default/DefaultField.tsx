import React from "react";
import Editor from "../Editor/Editor";
import { FieldProps } from "../RenderField";
import { targetTools, ComputationOp } from "shared/operations";
import { useEditorContext } from "../../editor/react/EditorProvider";
import { ContentEditable } from "../../editor/react/ContentEditable";
import { useIsEmpty } from "../../editor/react/useIsEmpty";
import { useGlobalState } from "../../state/state";
import { useSingular } from "../../state/useSingular";
import {
  decodeEditorComputation,
  encodeEditorComputation,
} from "shared/editor-computation";
import cl from "clsx";
import { getConfig } from "shared/initialValues";
import { createComputationTransformer } from "shared/computation-tools";
import {
  Computation,
  NestedDocument,
  FieldId,
  EditorComputation,
  Value,
  NestedField,
  NestedFolder,
  NestedElement,
  NestedDocumentId,
} from "@storyflow/backend/types";
import { useDocumentPageContext } from "../../documents/DocumentPageContext";
import { extendPath } from "@storyflow/backend/extendPath";
import { tools } from "shared/editor-tools";
import { useBuilderPath } from "../BuilderPath";
import { useFieldConfig } from "../../documents/collab/hooks";
import {
  getDocumentId,
  getRawFieldId,
  isNestedDocumentId,
} from "@storyflow/backend/ids";
import { useDocumentCollab } from "../../documents/collab/DocumentCollabContext";
import { useClient } from "../../client";
import { Plus } from "./Plus";
import {
  RenderNestedElement,
  RenderNestedDocument,
  RenderImportArgs,
  RenderFolder,
} from "./RenderNestedFields";
import { calculateFn } from "./calculateFn";
import { TemplateHeader } from "./TemplateHeader";
import { getPreview } from "./getPreview";
import { useIsFocused } from "../../editor/react/useIsFocused";
import { useFieldId } from "../FieldIdContext";
import { symb } from "@storyflow/backend/symb";

export const ParentPropContext = React.createContext<string | null>(null);

export const ParentProp = ({
  children,
  name,
}: {
  children: React.ReactNode;
  name: string;
}) => (
  <ParentPropContext.Provider value={name}>
    {children}
  </ParentPropContext.Provider>
);

export type Variant = "boolean" | "file" | "date" | "color" | null;

export const getVariant = (output: any): Variant => {
  if (typeof output === "boolean") {
    return "boolean";
  }
  if (typeof output === "string") {
    if (
      output.match(
        /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/
      )
    ) {
      return "color";
    }
    if (output.match(/\w+\.\w+/)) {
      return "file";
    }
  }
  return null;
};

export const findImportsFn = (value: Computation) => {
  return value.filter((el): el is NestedField => symb.isNestedField(el));
};

export const findFoldersFn = (value: Computation) => {
  return value.filter((el): el is NestedFolder => symb.isNestedFolder(el));
};

/*
const useDefaultState = ({ initialValue, path, history }: { initialValue: DBComputation, path: string, history: CollabHistory<DefaultOp> }) => {
  const initialValueFromHistory = React.useMemo(() => {
    const [, pkgs] = handleServerPackageArray(history);
    let value = initialValue;
    pkgs.forEach((pkg) => {
      unwrapServerPackage(pkg).operations.map((operation) => {
        value = inputConfig["default"].getNextState(value, operation);
      });
    });
    return value;
  }, []);

  const { imports } = useArticlePageContext();
  const parent = useGlobalState(parentPath, () =>
    calculate(
      getNestedChild(initialValue, "default", parentPath.split("."))
        ?.value as DBComputation,
      id.slice(0, 4),
      imports as any
    )
  );
}
*/

export default function DefaultField({
  id,
  fieldConfig,
  version,
  history,
  value,
}: FieldProps<"default" | "slug">) {
  if (id === "") {
    return (
      <div className="text-gray-400 font-light leading-6 pb-5">
        Intet indhold
      </div>
    );
  }

  const initialValue = React.useMemo(
    () =>
      (value?.length ?? 0) > 0
        ? value
        : (getConfig(fieldConfig.type).initialValue as Computation),
    []
  );

  const collab = useDocumentCollab();

  const { record } = useDocumentPageContext();

  React.useLayoutEffect(() => {
    /* MUST be useLayoutEffect to run before children useEffects that use the queue */
    collab
      .getOrAddQueue<ComputationOp>(getDocumentId(id), getRawFieldId(id), {
        transform: createComputationTransformer(id, record),
        mergeableNoop: { target: "0:0:", ops: [] },
      })
      .initialize(version, history ?? []);
  }, []);

  const [path] = useBuilderPath();
  const [config] = useFieldConfig(id);

  return (
    <>
      {path.length === 0 && config?.template && <TemplateHeader id={id} />}
      <WritableDefaultField
        id={id}
        hidden={path.length > 0}
        initialValue={initialValue}
        fieldConfig={fieldConfig}
      />
    </>
  );
}

export function WritableDefaultField({
  id,
  initialValue,
  fieldConfig,
  hidden,
}: {
  id: FieldId;
  initialValue: Computation;
  fieldConfig: { type: "default" | "slug" };
  hidden?: boolean;
}) {
  const rootId = useFieldId();
  const client = useClient();
  const { record } = useDocumentPageContext();

  const [output, setOutput] = useGlobalState<Value[]>(id, () =>
    calculateFn(rootId, initialValue, { record, client })
  );

  const transform =
    id === rootId ? getConfig(fieldConfig.type).transform : undefined;

  const initialEditorValue = encodeEditorComputation(initialValue, transform);

  const [computation, setComputation] = useGlobalState<EditorComputation>(
    `${id}#computation`,
    () => initialEditorValue
  );

  const [, setFunction] = useGlobalState<Value[]>(`${id}#function`, () =>
    calculateFn(rootId, initialValue, { record, client, returnFunction: true })
  );

  const [fieldImports, setFieldImports] = useGlobalState<NestedField[]>(
    `${id}#imports`,
    () => findImportsFn(initialValue)
  );

  /*
  const [folders, setFolders] = useGlobalState<NestedFolder[]>(
    `${id}#folders`,
    () => findFoldersFn(initialValue)
  );
  */

  const preview = getPreview(output);

  const target = targetTools.stringify({
    field: fieldConfig.type,
    operation: "computation",
    location: id === rootId ? "" : id,
  });

  const els = React.useMemo(
    () => output.filter((el): el is NestedElement => symb.isNestedElement(el)),
    [output]
  );

  const docs = React.useMemo(
    () =>
      output.filter(
        (el): el is NestedDocument & { id: NestedDocumentId } =>
          symb.isNestedDocument(el) && isNestedDocumentId(el.id)
      ),
    [output]
  );

  const folders = React.useMemo(
    () => output.filter((el): el is NestedFolder => symb.isNestedFolder(el)),
    [output]
  );

  const collab = useDocumentCollab();

  const actions = React.useMemo(
    () =>
      collab.boundMutate<ComputationOp>(
        getDocumentId(rootId),
        getRawFieldId(rootId)
      ),
    [collab]
  );

  const push = React.useCallback(
    (
      payload:
        | ComputationOp["ops"]
        | ((
            prev: ComputationOp["ops"] | undefined,
            noop: ComputationOp["ops"]
          ) => ComputationOp["ops"][])
    ) => {
      return actions.mergeablePush((_prev, noop) => {
        const result = [];
        let prev = _prev;
        if (_prev?.target !== target) {
          if (prev === noop) {
            prev = noop;
          } else {
            prev = undefined;
            result.push(prev);
          }
        }
        const newOps =
          typeof payload === "function"
            ? payload(prev?.ops, noop.ops)
            : [payload];
        return newOps.map((ops) => (ops === noop.ops ? noop : { target, ops }));
      });
    },
    [actions, target]
  );

  const singular = useSingular(`${rootId}${target}`);

  const setValue = React.useCallback((func: () => EditorComputation) => {
    singular(() => {
      setComputation(func);
      const encoded = func();
      const decoded = decodeEditorComputation(encoded, transform);
      console.log("COMPUTATION:", encoded, decoded);
      setOutput(() => calculateFn(rootId, decoded, { client, record }));
      setFunction(() =>
        calculateFn(rootId, decoded, { client, record, returnFunction: true })
      );
      setFieldImports(() => findImportsFn(decoded));
      // setFolders(() => findFoldersFn(decoded));
    });
  }, []);

  return (
    <>
      <Editor
        target={target}
        push={push}
        register={actions.register}
        initialValue={initialEditorValue}
        setValue={setValue}
        transform={transform}
      >
        <div className={cl("relative", hidden && "hidden")}>
          <Placeholder />
          <ContentEditable
            className={cl(
              "peer grow editor outline-none px-14 pb-5 font-light selection:bg-gray-700",
              "preview text-base leading-6"
              // mode === null || mode === "slug" ? "calculator" : ""
            )}
            data-value={preview !== `${computation[0]}` ? preview : ""}
          />
          <Plus />
        </div>
        {id === rootId && <FocusBg />}
      </Editor>
      {els.map((element) => (
        <RenderNestedElement
          key={element.id}
          nestedDocumentId={element.id}
          element={element.element}
        />
      ))}
      {docs.map((doc) => (
        <RenderNestedDocument key={doc.id} nestedDocumentId={doc.id} />
      ))}
      {folders.map((folder) => (
        <RenderFolder key={folder.id} nestedDocumentId={folder.id} />
      ))}
      {fieldImports.map((fieldImport) => (
        <RenderImportArgs
          key={fieldImport.id}
          nestedDocumentId={fieldImport.id}
        />
      ))}
    </>
  );
}

export function FocusBg() {
  const editor = useEditorContext();
  const isFocused = useIsFocused(editor);
  const [fullPath] = useBuilderPath();
  return (
    <div
      className={cl(
        "[.focused_&]:ring-1 [.focused_&]:ring-gray-200 dark:[.focused_&]:ring-gray-700",
        isFocused || fullPath.length > 0
          ? "bg-gray-50 dark:ring-gray-700 dark:bg-gray-800 ring-1"
          : "bg-transparent ring-gray-100 dark:ring-gray-800 group-hover/container:ring-1",
        "transition-[background-color,box-shadow]",
        "-z-10 absolute inset-2.5 rounded-md pointer-events-none"
      )}
    />
  );
}

export function Placeholder() {
  const editor = useEditorContext();
  const isFocused = useIsFocused(editor);
  const isEmpty = useIsEmpty(editor);
  return isEmpty ? (
    <div className="absolute pointer-events-none px-14 font-light opacity-25 select-none">
      {isFocused ? 'Tast "@" for genveje' : "Ikke udfyldt"}
    </div>
  ) : null;
}

/*
export function Placeholder({ className }: { className?: string }) {
  const editor = useEditorContext();
  const isEmpty = useIsEmpty(editor);

  return isEmpty ? (
    <div
      className={cl(
        "absolute pointer-events-none top-0 text-gray-400 font-light leading-8 py-2 -z-10 select-none",
        className
      )}
    >
      Intet indhold
    </div>
  ) : null;
}
*/
