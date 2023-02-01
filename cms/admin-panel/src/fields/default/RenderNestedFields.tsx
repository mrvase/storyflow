import React from "react";
import Editor from "../Editor/Editor";
import { ComputationOp } from "shared/operations";
import { ContentEditable } from "../../editor/react/ContentEditable";
import { useGlobalState } from "../../state/state";
import { encodeEditorComputation } from "shared/editor-computation";
import cl from "clsx";
import {
  Computation,
  LayoutElement,
  NestedDocument,
  FieldId,
  FieldImport,
} from "@storyflow/backend/types";
import {
  ChevronRightIcon,
  PlusIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { extendPath } from "@storyflow/backend/extendPath";
import { Fetcher, Filter } from "@storyflow/backend/types";
import { tools } from "shared/editor-tools";
import { stringifyPath, usePathContext } from "../PathContext";
import { getConfigFromType, useClientConfig } from "../../client-config";
import { Client, useClient } from "../../client";
import { ParentProp, WritableDefaultField } from "./DefaultField";
import { useFieldTemplate } from "./useFieldTemplate";
import { unwrap } from "@storyflow/result";

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

export function RenderFetcher({
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
export function RenderLayoutElement({
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

  const { libraries } = useClientConfig();

  const initialElement = React.useMemo(() => {
    if (!element) return;

    // initialValue is always the direct parent
    return initialValue?.find(
      (el): el is LayoutElement =>
        tools.isLayoutElement(el) && el.id === element
    );
  }, [path, initialValue]);

  const initialProps = getConfigFromType(type, libraries)?.props ?? [];

  return (
    <RenderNestedFields
      id={id}
      path={path}
      values={initialElement?.props ?? {}}
      template={initialProps}
    />
  );
}
export function RenderNestedDocument({
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
export function RenderImportArgs({
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
  template:
    | ({ arg: number; label: string } | { id: string; label: string })[]
    | readonly { name: string; label: string; options?: any }[];
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
                {...("options" in el
                  ? { options: el.options as string[] }
                  : {})}
              />
            </ParentProp>
          </React.Fragment>
        );
      })}
    </NestedFieldsWrapper>
  );
}
