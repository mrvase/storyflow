import React from "react";
import Editor from "./Editor/Editor";
import { FieldProps } from "./RenderField";
import { targetTools, ComputationOp } from "shared/operations";
import { useEditorContext } from "../editor/react/EditorProvider";
import { ContentEditable } from "../editor/react/ContentEditable";
import { useIsEmpty } from "../editor/react/useIsEmpty";
import { store, useSingular, useGlobalState } from "../state/state";
import { calculate } from "@storyflow/backend/calculate";
import { encodeEditorComputation } from "shared/editor-computation";
import cl from "clsx";
import { context, getContextKey } from "../state/context";
import {
  fetchArticle,
  getTemplateFieldsAsync,
  useArticleTemplate,
} from "../articles";
import { createComputationTransformer, getConfig } from "shared/fieldConfig";
import {
  ComputationBlock,
  Computation,
  FieldConfig,
  LayoutElement,
  NestedDocument,
  Value,
  FieldId,
  DocumentId,
  FieldImport,
} from "@storyflow/backend/types";
import { useArticlePageContext } from "../articles/ArticlePage";
import {
  ArrowDownOnSquareIcon,
  ArrowLeftIcon,
  CalendarIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  DocumentIcon,
  LinkIcon,
  PaintBrushIcon,
  PhotoIcon,
  PlusIcon,
  SparklesIcon,
  Squares2X2Icon,
  SwatchIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { extendPath } from "@storyflow/backend/extendPath";
import { Fetcher, Filter } from "@storyflow/backend/types";
import { tools } from "shared/editor-tools";
import { stringifyPath, usePathContext } from "./FieldContainer";
import { useClientConfig } from "../client-config";
import {
  $createParagraphNode,
  $getRoot,
  $getSelection,
  $isNodeSelection,
  $isParagraphNode,
  $isRangeSelection,
  LexicalNode,
} from "lexical";
import { useIsFocused as useEditorIsFocused } from "../editor/react/useIsFocused";
import {
  addFetcher,
  addImport,
  addLayoutElement,
  addNestedDocument,
} from "../custom-events";
import { useFieldConfig } from "../state/documentConfig";
import {
  getComputationRecord,
  restoreComputation,
} from "@storyflow/backend/flatten";
import { getDocumentId, getTemplateFieldId } from "@storyflow/backend/ids";
import { MenuTransition } from "../elements/transitions/MenuTransition";
import { $isDocumentNode } from "./decorators/DocumentNode";
import useIsFocused from "../utils/useIsFocused";
import { useMathMode } from "./Editor/ContentPlugin";
import { unwrap } from "@storyflow/result";
import {
  $createHeadingNode,
  $isHeadingNode,
} from "../editor/react/HeadingNode";
import { useCollab } from "../state/collaboration";
import { Client, useClient } from "../client";

export const useFieldTemplate = (id: FieldId) => {
  const [config] = useFieldConfig(id);
  const article = useArticleTemplate(config?.template);
  const [template, setTemplate] = React.useState<FieldConfig[]>();

  const client = useClient();

  React.useLayoutEffect(() => {
    if (!article) return;
    (async () => {
      const fields = await getTemplateFieldsAsync(article.config, client);
      setTemplate(fields);
    })();
  }, [article]);

  return template;
};

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

export const getPreview = (output: Computation) => {
  const valueAsString = (value: any) => {
    if (typeof value === "boolean") {
      return value ? "SAND" : "FALSK";
    }
    if (typeof value === "number") {
      return value.toFixed(2).replace(".", ",").replace(",00", "");
    }
    if (typeof value === "object") {
      return "type" in value ? `{ ${value.type} }` : JSON.stringify(value);
    }
    return `${value}`;
  };
  if (output.length === 0) {
    return "";
  }
  if (output.length === 1) {
    return valueAsString(output[0]);
  }

  return `[${output.map((el) => valueAsString(el)).join(", ")}]`;
};

export const calculateFn = (
  id: FieldId,
  value: Computation,
  imports: ComputationBlock[] = [],
  client: Client
): Value[] => {
  const getter = (id: FieldId) => {
    if (id.startsWith("ctx:")) {
      return context.use<Value[]>(getContextKey(getDocumentId(id), id.slice(4)))
        .value;
    }

    if (id.indexOf(".") > 0) {
      return store.use<Value[]>(id).value ?? [];
    }

    const imp = imports.find((el) => el.id === id);

    if (imp) {
      const value = restoreComputation(imp.value, imports);
      if (!value) return store.use<Value[]>(id).value ?? [];
      const fn = () => calculateFn(imp.id, value, imports, client);
      return store.use<Value[]>(id, fn).value;
    }

    const asyncFn = fetchArticle(getDocumentId(id), client).then((article) => {
      if (!article) return undefined;
      const value = getComputationRecord(article)[id as FieldId];
      if (!value) return undefined;
      const fn = () => calculateFn(id, value, imports, client);
      return fn;
    });

    return store.useAsync(id, asyncFn).value ?? [];
  };

  return calculate(id, value, getter);
};

export const findImportsFn = (value: Computation) => {
  return value.filter((el): el is FieldImport => tools.isImport(el, "field"));
};

export const findFetchersFn = (value: Computation) => {
  return value.reduce(
    (acc, fetcher, index) =>
      tools.isFetcher(fetcher) ? acc.concat({ index, fetcher }) : acc,
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
  history,
  value,
}: FieldProps<"default" | "slug">) {
  if (id === "") {
    return (
      <div className="text-gray-400 font-light leading-6 pt-1 pb-5">
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
        mergeable: 500,
      })
      .initialize(history ?? []);
  }, []);

  const [config] = useFieldConfig(id);

  return (
    <>
      {config?.template && <TemplateHeader id={id} />}
      <WritableDefaultField
        id={id}
        path=""
        initialValue={initialValue}
        fieldConfig={fieldConfig}
      />
    </>
  );
}

function TemplateHeader({ id }: { id: FieldId }) {
  const template = useFieldTemplate(id);
  const { path } = usePathContext();

  if (path.length !== 0 || !template) return null;

  return (
    <div className="px-14">
      <div
        className={cl(
          "w-full flex divide-x divide-sky-800 rounded mt-2 -mb-0.5",
          "dark:bg-gray-900 dark:text-sky-200",
          "text-sm",
          "ring-1 ring-sky-200 dark:ring-sky-800"
        )}
      >
        <div className="w-5 flex-center">
          <ChevronDownIcon className="w-3 h-3" />
        </div>
        {(template ?? []).map(({ id: columnId, label }) => (
          <div
            key={columnId}
            className="grow shrink basis-0 px-2 flex items-center"
          >
            <span className="truncate">{label}</span>
            <LinkIcon
              className="w-3 h-3 ml-auto opacity-25 hover:opacity-100"
              onMouseDown={(ev) => {
                ev.preventDefault();
                addImport.dispatch({
                  id,
                  templateId: getTemplateFieldId(columnId),
                  imports: [],
                });
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function WritableDefaultField({
  id,
  path,
  initialValue,
  fieldConfig,
}: {
  id: FieldId;
  path: string;
  initialValue: Computation;
  fieldConfig: { type: "default" | "slug" };
}) {
  const { path: fullPath } = usePathContext();
  const isActive =
    stringifyPath(fullPath) === path.split("/").slice(0, -1).join("/");

  const { imports } = useArticlePageContext();

  const client = useClient();

  const [_output, setOutput] = useGlobalState<
    (Computation[number] | Computation)[]
  >(extendPath(id, path), () => calculateFn(id, initialValue, imports, client));

  const output: Computation = _output.flat(1) as any;

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

  const transform =
    path === "" ? getConfig(fieldConfig.type).transform : undefined;

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
        | ((prev: ComputationOp["ops"] | undefined) => ComputationOp["ops"][]),
      noTracking?: boolean
    ) => {
      return actions.push((_prev) => {
        const prev = _prev?.target === target ? _prev : undefined; // only treat as mergeable if they have same target.
        const newOps =
          typeof payload === "function" ? payload(prev?.ops) : [payload];
        return newOps.map((ops) => ({ target, ops }));
      }, noTracking);
    },
    [actions, target]
  );

  const singular = useSingular(`${id}${target}`);

  const setValue = React.useCallback((func: () => Computation) => {
    singular(() => {
      const decoded = func();
      setOutput(() => calculateFn(id, decoded, [], client));
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
        initialValue={encodeEditorComputation(initialValue, transform)}
        setValue={setValue}
        transform={transform}
      >
        <div className={cl("relative", !isActive && "hidden")}>
          <ContentEditable
            className={cl(
              "peer grow editor outline-none px-14 pt-1 pb-4 font-light selection:bg-gray-700",
              "preview text-base leading-6"
              // mode === null || mode === "slug" ? "calculator" : ""
            )}
            data-value={
              (preview === output[0] ||
                output.some((el) => Array.isArray(el) && el[0] === "n")) &&
              fieldConfig.type !== "slug"
                ? ""
                : preview
            }
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

const fetchFn = (fetcher: Fetcher, client: Client) => {
  const isFetcherFetchable = (
    fetcher: Fetcher
  ): fetcher is Fetcher & {
    filters: {
      field: Exclude<Filter["field"], "">;
      operation: Exclude<Filter["operation"], "">;
      value: Computation;
    }[];
  } => {
    return (
      fetcher.filters.length > 0 &&
      fetcher.filters.every(
        (el: Filter) =>
          el.value.length > 0 &&
          ![el.field, el.operation].some((el: any) =>
            ["", null, undefined].includes(el)
          )
      )
    );
  };

  if (isFetcherFetchable(fetcher)) {
    return client.articles.getListFromFilters.query(fetcher).then((res) => {
      return unwrap(res, []);
    });
  } else {
    return [];
  }
};

function RenderFetcher({
  id,
  path: parentPath,
  fetcher: currentFetcher,
  index,
  push,
}: {
  id: FieldId;
  path: string;
  fetcher: Fetcher;
  index: number;
  push: (ops: ComputationOp["ops"]) => void;
}) {
  const path = extendPath(parentPath, currentFetcher.id);
  const { goToPath } = usePathContext();

  const [fetcher, _setFetcher] = React.useState(currentFetcher);
  const [isModified, setIsModified] = React.useState(false);
  const setFetcher: typeof _setFetcher = (value) => {
    setIsModified(true);
    _setFetcher(value);
  };

  const client = useClient();

  const [, setOutput] = useGlobalState<NestedDocument[]>(
    extendPath(id, path),
    () => fetchFn({ ...fetcher }, client)
  );

  return (
    <NestedFieldsWrapper path={path} hideWhenInactive>
      {fetcher.filters.map((filter, index) => (
        <FilterComp
          key={index}
          id={id}
          // path={extendPath(path, `${index}`, "/")}
          setFetcher={setFetcher}
          index={index}
          filter={filter}
        />
      ))}
      <div
        onClick={() => {
          setFetcher((ps) => ({
            ...ps,
            filters: [...ps.filters, { field: "", operation: "", value: [] }],
          }));
        }}
        className="flex items-center text-xs opacity-50 cursor-default"
      >
        <div className="w-4 mx-5 flex-center opacity-75 px-13 h-5">
          <PlusIcon className="w-3 h-3" />
        </div>
        TILFØJ FILTER
      </div>
      <button
        className={cl(
          "bg-teal-600 rounded px-3 py-1.5 ml-14 mt-5 text-sm font-light hover:bg-teal-500 transition-colors",
          !isModified && "opacity-50"
        )}
        onClick={() => {
          if (isModified) {
            setOutput(() => fetchFn({ ...fetcher }, client));
            push([
              {
                index,
                insert: [{ ...fetcher }],
                remove: 1,
              },
            ]);
            goToPath(null);
            setIsModified(false);
          }
        }}
      >
        Aktiver ændringer
      </button>
    </NestedFieldsWrapper>
  );
}

function FilterComp({
  id,
  setFetcher,
  index,
  filter,
}: {
  id: FieldId;
  setFetcher: (callback: (ps: Fetcher) => Fetcher) => void;
  index: number;
  filter: Filter;
}) {
  const setFilterValue = React.useCallback(
    (field: string, value: any) =>
      setFetcher((ps) => {
        const filters = [...ps.filters];
        filters[index] = { ...filters[index], [field]: value };
        return { ...ps, filters };
      }),
    []
  );

  const setValue = React.useCallback(
    (value: () => Computation) => setFilterValue("value", value()),
    []
  );

  return (
    <div className="flex items-start">
      <div
        className="w-4 mx-5 flex-center opacity-40 px-13 h-5"
        onClick={() => {
          setFetcher((ps) => ({
            ...ps,
            filters: ps.filters.filter((el) => el !== filter),
          }));
        }}
      >
        <XMarkIcon className="w-3 h-3" />
      </div>
      <div className="grow shrink basis-0">
        <div
          className={cl("text-sm opacity-50 flex items-center cursor-default")}
        >
          Felt
        </div>
        <input
          type="text"
          value={filter.field}
          onChange={(ev) => setFilterValue("field", ev.target.value)}
          className="bg-transparent pt-1 pb-4 outline-none font-light w-full"
        />
      </div>
      <div className="grow shrink basis-0">
        <div
          className={cl("text-sm opacity-50 flex items-center cursor-default")}
        >
          Operation
        </div>
        <input
          type="text"
          value={filter.operation}
          onChange={(ev) => setFilterValue("operation", ev.target.value)}
          className="bg-transparent pt-1 pb-4 outline-none font-light w-full"
        />
      </div>
      <div className="grow shrink basis-0">
        <div
          className={cl("text-sm opacity-50 flex items-center cursor-default")}
        >
          Værdi
        </div>
        <Editor
          id={id}
          initialValue={encodeEditorComputation(filter.value)}
          setValue={setValue}
        >
          <div className={cl("relative")}>
            <ContentEditable
              className={cl(
                "peer grow editor outline-none pt-1 pb-4 font-light selection:bg-gray-700",
                "preview text-base leading-6"
                // mode === null || mode === "slug" ? "calculator" : ""
              )}
            />
          </div>
        </Editor>
      </div>
    </div>
  );
}

function NestedLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={cl(
        "text-sm opacity-50 flex items-center px-13 cursor-default"
      )}
    >
      <div className="w-4 mx-5 flex-center opacity-75">
        <ChevronRightIcon className="w-3 h-3" />
      </div>
      {children}
    </div>
  );
}

function RenderLayoutElement({
  id,
  type,
  path,
  initialValue,
}: {
  id: FieldId;
  type: string;
  path: string;
  initialValue: Computation;
}) {
  const element = path.split(".").slice(-1)[0]; // e

  const { components } = useClientConfig();

  const initialElement = React.useMemo(() => {
    if (!element) return;

    // initialValue is always the direct parent
    return initialValue?.find(
      (el): el is LayoutElement =>
        tools.isLayoutElement(el) && el.id === element
    );
  }, [path, initialValue]);

  const initialProps = components[type as "Element"]?.props ?? [];

  return (
    <RenderNestedFields
      id={id}
      path={path}
      values={initialElement?.props ?? {}}
      template={initialProps}
    />
  );
}

function RenderNestedDocument({
  id,
  path,
  initialValue,
}: {
  id: FieldId;
  path: string;
  initialValue: Computation;
}) {
  const docId = path.split(".").slice(-1)[0];

  const template = useFieldTemplate(id) ?? [];

  const initialDoc = React.useMemo(() => {
    if (!docId) return;

    return initialValue.find(
      (el): el is NestedDocument =>
        tools.isNestedDocument(el) && el.id === docId
    );
  }, [path, initialValue]);

  return (
    <RenderNestedFields
      id={id}
      path={path}
      values={initialDoc?.values ?? {}}
      template={template}
    />
  );
}

function RenderImportArgs({
  id,
  path,
  initialValue,
}: {
  id: FieldId;
  path: string;
  initialValue: Computation;
}) {
  const importId = path.split(".").slice(-1)[0];

  const initialImport = React.useMemo(() => {
    if (!importId) return;
    return initialValue.find(
      (el): el is FieldImport =>
        tools.isImport(el, "field") && el.id === importId
    );
  }, [path, initialValue]);

  return (
    <RenderNestedFields
      id={id}
      path={path}
      values={initialImport?.args ?? {}}
      template={[{ arg: 0, label: "Parameter 1" }]}
    />
  );
}

function NestedFieldsWrapper({
  path,
  children,
  hideWhenInactive = false,
}: {
  path: string;
  children: React.ReactNode;
  hideWhenInactive?: boolean;
}) {
  const { path: fullPath } = usePathContext();
  const isActive = stringifyPath(fullPath) === path;

  return (
    <div
      className={cl(
        isActive ? "py-8 focus-permanent" : hideWhenInactive && "hidden"
      )}
    >
      {children}
    </div>
  );
}

function RenderNestedFields({
  id,
  path,
  values,
  template,
}: {
  id: FieldId;
  path: string;
  values: Record<string, Computation>;
  template: (
    | { arg: number; label: string }
    | { id: string; label: string }
    | { name: string; label: string }
  )[];
}) {
  const { path: fullPath } = usePathContext();
  const isActive = stringifyPath(fullPath) === path;

  return (
    <NestedFieldsWrapper path={path}>
      {template.map((el) => {
        const label = el.label;
        const name =
          "id" in el ? el.id.slice(4) : "name" in el ? el.name : el.arg;
        const initialValue = values[name] ?? [];
        return (
          <React.Fragment key={name}>
            <div className={cl(!isActive && "hidden")}>
              <NestedLabel>{label}</NestedLabel>
            </div>
            <ParentProp label={label} name={`${name}`}>
              <WritableDefaultField
                id={id}
                path={extendPath(path, `${name}`, "/")}
                initialValue={initialValue}
                fieldConfig={{ type: "default" }}
              />
            </ParentProp>
          </React.Fragment>
        );
      })}
    </NestedFieldsWrapper>
  );
}

function Plus() {
  const editor = useEditorContext();

  const [mathMode, setMathMode] = useMathMode({});

  const read = (func: () => any) => editor.getEditorState().read(func);
  const isEditorEmpty = () => {
    return !editor.isComposing() && $getRoot().getTextContent() === "";
  };
  const hasEditorDocument = () => {
    return $getRoot()
      .getChildren()
      .some((el) => $isDocumentNode(el));
  };
  const isBlockFocused = () => {
    return !$isRangeSelection($getSelection());
  };

  const isFocused = useEditorIsFocused(editor);

  const offset = 4;

  const [y, setY] = React.useState<number | null>(null);

  const [isEmpty, setIsEmpty] = React.useState(() =>
    read(() => isEditorEmpty())
  );
  const [hasDocument, setHasDocument] = React.useState(() =>
    read(() => hasEditorDocument())
  );
  const [blockIsFocused, setBlockIsFocused] = React.useState(() =>
    read(() => isBlockFocused())
  );

  const normalize = (value: number) => value - ((value - 4) % 24);

  React.useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        setIsEmpty(isEditorEmpty());
        setHasDocument(hasEditorDocument());
        setBlockIsFocused(isBlockFocused());
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          const root = editor.getRootElement()?.getBoundingClientRect()?.y ?? 0;
          const y =
            editor
              .getElementByKey(selection.anchor.key)
              ?.getBoundingClientRect()?.y ?? 0;
          setY(normalize(offset + y - root));
        } else if ($isNodeSelection(selection)) {
          const root = editor.getRootElement()?.getBoundingClientRect()?.y ?? 0;
          const key = selection.getNodes()[0].__key;
          const y =
            editor.getElementByKey(key)?.getBoundingClientRect()?.y ?? 0;
          setY(normalize(offset + y - root));
        }
      });
    });
  }, [editor]);

  const formatHeading = () => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        let node: LexicalNode = selection.anchor.getNode();
        if (selection.anchor.type === "text") {
          node = node.getParent() as LexicalNode;
          node = (node.isInline() ? node.getParent() : node) as LexicalNode;
        }
        const isP = $isParagraphNode(node);
        const isH = $isHeadingNode(node);
        if (isP || isH) {
          const targetElement = isP
            ? $createHeadingNode("h1")
            : $createParagraphNode();
          targetElement.setFormat(node.getFormatType());
          targetElement.setIndent(node.getIndent());
          node.replace(targetElement, true);
        }
      }
    });
  };

  return isFocused && y !== null ? (
    <>
      <div
        className="absolute top-0 left-0 w-4 h-4 m-1 mx-5 opacity-50 hover:opacity-100"
        style={{ transform: `translateY(${y}px)` }}
        onMouseDown={(ev) => {
          ev.preventDefault();
          formatHeading();
        }}
      >
        <PaintBrushIcon className="w-4 h-4" />
      </div>
      <Menu
        isEmpty={isEmpty}
        hasDocument={hasDocument}
        blockIsFocused={blockIsFocused}
        y={y}
        mathMode={mathMode}
        setMathMode={setMathMode}
      />
    </>
  ) : null;
}

function Menu({
  isEmpty,
  hasDocument,
  blockIsFocused,
  y,
  mathMode,
  setMathMode,
}: {
  isEmpty: boolean;
  hasDocument: boolean;
  blockIsFocused: boolean;
  y: number;
  mathMode: boolean;
  setMathMode: (callback: (ps: boolean) => boolean) => void;
}) {
  const canAddDocument = isEmpty || hasDocument;
  const canAddElement = !hasDocument;
  const canAddRichText = !hasDocument && !blockIsFocused;

  const openElementWindow = canAddElement && !canAddDocument && !canAddRichText;

  const [menuId, setMenuId] = React.useState<
    "select" | "template" | "element" | null
  >(null);

  const { isFocused, handlers } = useIsFocused();

  React.useEffect(() => {
    if (!isFocused) {
      setMenuId(null);
    }
  }, [isFocused]);

  const components = useClientConfig().components;

  return (
    <div
      className="absolute z-10 top-0 right-0 w-8 h-8 -m-1 mx-3"
      style={{ transform: `translateY(${y}px)` }}
      {...handlers}
      onMouseDown={(ev) => {
        ev.preventDefault();
        handlers.onMouseDown(ev);
      }}
    >
      <button
        type="button"
        className="opacity-50 hover:opacity-100 p-2"
        onMouseDown={(ev: any) => {
          ev.preventDefault();
          //addLayoutElement.dispatch();
        }}
        onClick={() => setMenuId(openElementWindow ? "element" : "select")}
      >
        <PlusIcon className="w-4 h-4" />
      </button>
      <MenuTransition show={menuId !== null} className="absolute right-0">
        <div className="relative text-xs w-60 h-48">
          <Window
            show={menuId !== null}
            background={menuId !== "select"}
            className="flex flex-col gap-2"
          >
            <div>
              {canAddElement && (
                <Button
                  className="w-full"
                  onClick={() => {
                    setMenuId("element");
                  }}
                >
                  <Squares2X2Icon className="w-4 h-4 ml-1 mr-2" /> Element
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              {canAddDocument && (
                <Button
                  className="grow shrink basis-0"
                  onClick={() => {
                    addNestedDocument.dispatch();
                  }}
                >
                  <DocumentIcon className="w-4 h-4 ml-1 mr-2" /> Dokument
                </Button>
              )}
              {canAddDocument && (
                <Button
                  className="grow shrink basis-0"
                  onClick={() => {
                    addFetcher.dispatch();
                  }}
                >
                  <ArrowDownOnSquareIcon className="w-4 h-4 ml-1 mr-2" />{" "}
                  Fetcher
                </Button>
              )}
            </div>
            {canAddRichText && (
              <div className="flex gap-2">
                {[
                  { label: "Farve", Icon: SwatchIcon },
                  { label: "Billede", Icon: PhotoIcon },
                  { label: "Dato", Icon: CalendarIcon },
                  { label: "Boolean", Icon: CheckCircleIcon },
                  {
                    label: "Link",
                    Icon: LinkIcon,
                    onClick() {
                      addLayoutElement.dispatch("Link");
                    },
                  },
                ].map(({ Icon, onClick }) => (
                  <Button
                    className="grow shrink basis-0 justify-center"
                    onClick={onClick}
                  >
                    <Icon className="w-4 h-4" />
                  </Button>
                ))}
              </div>
            )}
            {!hasDocument && (
              <Button
                className="justify-center"
                onClick={() => {
                  setMathMode((ps) => !ps);
                  setMenuId(null);
                }}
              >
                Skift til
                <strong className="ml-1">
                  {mathMode ? "tekst" : "matematik"}
                </strong>
              </Button>
            )}
          </Window>
          <Window show={menuId === "element"}>
            <div className="flex items-center gap-2">
              <Button onClick={() => setMenuId("select")}>
                <ArrowLeftIcon className="w-4 h-4" />
              </Button>
              Vælg element
            </div>
            <div className="overflow-y-auto mt-2 no-scrollbar h-[8.5rem]">
              <div className="flex flex-col gap-2">
                {Object.entries(components).map(([key, { label }]) => (
                  <Button
                    onClick={(ev) => {
                      addLayoutElement.dispatch(key);
                    }}
                  >
                    {label ?? key}
                  </Button>
                ))}
              </div>
            </div>
          </Window>
          <Window show={menuId === "template"}>Vælg template</Window>
        </div>
      </MenuTransition>
    </div>
  );
}

function Window({
  show,
  background,
  children,
  className,
}: {
  show: boolean;
  background?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cl(
        "bg-gray-800 p-2 absolute inset-x-0 top-0 shadow-lg rounded overflow-hidden",
        show
          ? "opacity-100 translate-x-0"
          : "opacity-0 translate-x-5 pointer-events-none",
        "transition-[opacity,transform] ease-out",
        className
      )}
    >
      {children}
    </div>
  );
}

function Button({
  children,
  className,
  onClick,
}: {
  children?: React.ReactNode;
  className?: string;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
}) {
  return (
    <button
      type="button"
      className={cl(
        "p-2 bg-gray-700/50 flex items-center rounded text-gray-600 dark:text-gray-100 hover:bg-teal-100 hover:text-teal-600 dark:hover:bg-teal-600 dark:hover:text-teal-100 transition-colors",
        className
      )}
      onClick={onClick}
    >
      {children}
    </button>
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
