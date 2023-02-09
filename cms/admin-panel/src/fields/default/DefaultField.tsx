import React from "react";
import Editor from "../Editor/Editor";
import { FieldProps } from "../RenderField";
import { targetTools, ComputationOp } from "shared/operations";
import { useEditorContext } from "../../editor/react/EditorProvider";
import { ContentEditable } from "../../editor/react/ContentEditable";
import { useIsEmpty } from "../../editor/react/useIsEmpty";
import { useSingular, useGlobalState } from "../../state/state";
import {
  decodeEditorComputation,
  encodeEditorComputation,
} from "shared/editor-computation";
import cl from "clsx";
import { createComputationTransformer, getConfig } from "shared/fieldConfig";
import {
  Computation,
  LayoutElement,
  NestedDocument,
  FieldId,
  FieldImport,
  EditorComputation,
  Value,
} from "@storyflow/backend/types";
import { useArticlePageContext } from "../../articles/ArticlePageContext";
import { extendPath } from "@storyflow/backend/extendPath";
import { Fetcher } from "@storyflow/backend/types";
import { tools } from "shared/editor-tools";
import { stringifyPath, usePathContext } from "../PathContext";
import { useFieldConfig } from "../../state/documentConfig";
import { getDocumentId, getTemplateFieldId } from "@storyflow/backend/ids";
import { useCollab } from "../../state/collaboration";
import { useClient } from "../../client";
import { Plus } from "./Plus";
import {
  RenderLayoutElement,
  RenderNestedDocument,
  RenderFetcher,
  RenderImportArgs,
} from "./RenderNestedFields";
import { calculateFn } from "./calculateFn";
import { TemplateHeader } from "./TemplateHeader";
import { getPreview } from "./getPreview";

export const ParentPropContext = React.createContext<{
  name: string;
  label: string;
} | null>(null);

export const ParentProp = ({
  children,
  name,
  label,
}: {
  children: React.ReactNode;
  name: string;
  label: string;
}) => (
  <ParentPropContext.Provider
    value={React.useMemo(() => ({ name, label }), [name, label])}
  >
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
  return value.filter((el): el is FieldImport => tools.isFieldImport(el));
};

export const findFetchersFn = (value: Computation) => {
  return value.reduce(
    (acc, fetcher, index) =>
      tools.isFetcher(fetcher) ? acc.concat([{ index, fetcher }]) : acc,
    [] as { index: number; fetcher: Fetcher }[]
  );
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

  const collab = useCollab();

  React.useLayoutEffect(() => {
    /* MUST be useLayoutEffect to run before children useEffects that use the queue */
    collab
      .getOrAddQueue<ComputationOp>(id.slice(0, 4), id.slice(4), {
        transform: createComputationTransformer(initialValue),
        mergeableNoop: { target: "0:0:", ops: [] },
      })
      .initialize(version, history ?? []);
  }, []);

  const [path] = usePathContext();
  const [config] = useFieldConfig(id);

  return (
    <>
      {path.length === 0 && config?.template && <TemplateHeader id={id} />}
      <WritableDefaultField
        id={id}
        path=""
        initialValue={initialValue}
        fieldConfig={fieldConfig}
      />
    </>
  );
}

export function WritableDefaultField({
  id,
  path,
  initialValue,
  fieldConfig,
  options,
}: {
  id: FieldId;
  path: string;
  initialValue: Computation;
  fieldConfig: { type: "default" | "slug" };
  options?: string[];
}) {
  const [fullPath] = usePathContext();
  const isActive =
    stringifyPath(fullPath) === path.split("/").slice(0, -1).join("/");

  const { imports } = useArticlePageContext();

  const client = useClient();

  const [output, setOutput] = useGlobalState<Value[]>(
    extendPath(id, path),
    () => calculateFn(id, initialValue, { imports, client })
  );

  const transform =
    path === "" ? getConfig(fieldConfig.type).transform : undefined;

  const initialEditorValue = encodeEditorComputation(initialValue, transform);

  const [computation, setComputation] = useGlobalState<EditorComputation>(
    `${extendPath(id, path)}#computation`,
    () => initialEditorValue
  );

  const isEmpty =
    computation.length === 0 ||
    (computation.length === 1 && computation[0] === "");

  const [, setFunction] = useGlobalState<Computation>(
    `${extendPath(id, path)}#function`,
    () =>
      calculateFn(id, initialValue, { imports, client, returnFunction: true })
  );

  const [fieldImports, setFieldImports] = useGlobalState<FieldImport[]>(
    `${extendPath(id, path)}#imports`,
    () => findImportsFn(initialValue)
  );

  const [fetchers, setFetchers] = useGlobalState<
    { fetcher: Fetcher; index: number }[]
  >(`${extendPath(id, path)}#fetchers`, () => findFetchersFn(initialValue));

  const preview = getPreview(output);

  const target = targetTools.stringify({
    field: fieldConfig.type,
    operation: "computation",
    location: path,
  });

  const els = React.useMemo(
    () => output.filter((el): el is LayoutElement => tools.isLayoutElement(el)),
    [output]
  );

  const docs = React.useMemo(
    () =>
      output.filter((el): el is NestedDocument => tools.isNestedDocument(el)),
    [output]
  );

  const collab = useCollab();

  const actions = React.useMemo(
    () =>
      collab.boundMutate<ComputationOp>(
        getDocumentId(id),
        getTemplateFieldId(id)
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

  const singular = useSingular(`${id}${target}`);

  const setValue = React.useCallback((func: () => EditorComputation) => {
    singular(() => {
      setComputation(func);
      const encoded = func();
      const decoded = decodeEditorComputation(encoded, transform);
      setOutput(() => calculateFn(id, decoded, { client, imports }));
      setFunction(() =>
        calculateFn(id, decoded, { client, imports, returnFunction: true })
      );
      setFieldImports(() => findImportsFn(decoded));
      setFetchers(() => findFetchersFn(decoded));
    });
  }, []);

  return (
    <>
      <Editor
        target={target}
        id={id}
        push={push}
        register={actions.register}
        initialValue={initialEditorValue}
        setValue={setValue}
        transform={transform}
        options={options}
      >
        <div className={cl("relative", !isActive && "hidden")}>
          {isEmpty && (
            <div className="absolute pointer-events-none px-14 pt-1 font-light opacity-25">
              Ikke udfyldt
            </div>
          )}
          <ContentEditable
            className={cl(
              "peer grow editor outline-none px-14 pt-1 pb-5 font-light selection:bg-gray-700",
              "preview text-base leading-6"
              // mode === null || mode === "slug" ? "calculator" : ""
            )}
            data-value={preview !== output[0] ? preview : ""}
          />
          <Plus />
        </div>
      </Editor>
      {els.map((element) => (
        <RenderLayoutElement
          key={element.id}
          id={id}
          path={extendPath(path, element.id)}
          type={element.type}
          initialValue={initialValue}
        />
      ))}
      {docs.map((doc) => (
        <RenderNestedDocument
          key={doc.id}
          id={id}
          path={extendPath(path, doc.id)}
          initialValue={initialValue}
        />
      ))}
      {fetchers.map(({ index, fetcher }) => (
        <RenderFetcher
          key={fetcher.id}
          id={id}
          path={path}
          fetcher={fetcher}
          index={index}
          push={push}
        />
      ))}
      {fieldImports.map((fieldImport) => (
        <RenderImportArgs
          key={fieldImport.id}
          id={id}
          path={extendPath(path, fieldImport.id)}
          initialValue={initialValue}
        />
      ))}
    </>
  );
}

export function Placeholder({ className }: { className?: string }) {
  const editor = useEditorContext();
  const isEmpty = useIsEmpty(editor);

  return isEmpty ? (
    <div
      className={cl(
        "absolute pointer-events-none top-0 text-gray-400 font-light leading-8 py-2 -z-10",
        className
      )}
    >
      Intet indhold
    </div>
  ) : null;
}
