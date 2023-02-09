import React from "react";
import Editor from "../Editor/Editor";
import { ComputationOp } from "shared/operations";
import { ContentEditable } from "../../editor/react/ContentEditable";
import { useGlobalState } from "../../state/state";
import {
  decodeEditorComputation,
  encodeEditorComputation,
} from "shared/editor-computation";
import cl from "clsx";
import {
  Computation,
  LayoutElement,
  NestedDocument,
  FieldId,
  FieldImport,
  EditorComputation,
  Value,
} from "@storyflow/backend/types";
import {
  Bars3Icon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { extendPath } from "@storyflow/backend/extendPath";
import { Fetcher, Filter } from "@storyflow/backend/types";
import { tools } from "shared/editor-tools";
import { stringifyPath, usePathContext } from "../PathContext";
import { getConfigFromType, useClientConfig } from "../../client-config";
import { useClient } from "../../client";
import { ParentProp, WritableDefaultField } from "./DefaultField";
import { useFieldTemplate } from "./useFieldTemplate";
import { fetchFn } from "./calculateFn";

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
  const [, setPath] = usePathContext();

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
    <IfActive path={path} then="pb-5 focus-permanent" else="hidden">
      <div>
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
              setPath(() => []);
              setIsModified(false);
            }
          }}
        >
          Aktiver ændringer
        </button>
      </div>
    </IfActive>
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
    (value: () => EditorComputation) =>
      setFilterValue("value", decodeEditorComputation(value())),
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
  const [fullPath, setPath] = usePathContext();

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

  const [key] = useGlobalState<Value[]>(extendPath(id, `${path}/key`));

  const [listIsOpen_, toggleListIsOpen] = React.useReducer((ps) => !ps, false);
  React.useEffect(() => {
    if (!listIsOpen_ && (key?.length ?? 0) > 0) {
      console.log("SET IS OPEN");
      toggleListIsOpen();
    }
  }, [listIsOpen_, key]);

  const listIsOpen = listIsOpen_ || (key?.length ?? 0) > 0;

  console.log("KEY", key);

  return (
    <>
      <IfActive else="hidden" path={path}>
        <div>
          <div>
            <div className="pb-5 text-gray-300 text-sm flex items-center">
              <div className="mx-5 w-4">
                <button
                  className="w-4 h-4 rounded-full bg-gray-700 hover:scale-150 hover:bg-gray-600 flex-center transition-[transform,colors]"
                  onClick={() => setPath((ps) => ps.slice(0, -1))}
                >
                  <ChevronLeftIcon className="w-3 h-3" />
                </button>
              </div>
              {fullPath.slice(-1)[0]?.label ?? ""}
              <button
                className="ml-auto mr-5 w-4 h-4 flex-center rounded-full bg-gray-700"
                onClick={toggleListIsOpen}
              >
                <Bars3Icon className="w-3 h-3" />
              </button>
            </div>
          </div>
          <div className={listIsOpen ? "" : "hidden"}>
            <RenderNestedField
              id={id}
              path={path}
              initialValue={(initialElement?.props ?? {})["key"] ?? []}
              label={"Lav til liste"}
              labelColor="blue"
              icon={Bars3Icon}
              name="key"
            />
          </div>
        </div>
      </IfActive>
      <RenderNestedFields
        id={id}
        path={path}
        values={initialElement?.props ?? {}}
        template={initialProps}
      />
    </>
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
      (el): el is FieldImport => tools.isFieldImport(el) && el.id === importId
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

function IfActive({
  path,
  then: then_,
  else: else_,
  children,
}: {
  path: string;
  then?: string;
  else?: string;
  children: React.ReactElement;
}) {
  const [fullPath] = usePathContext();
  const isActive = stringifyPath(fullPath) === path;

  return React.cloneElement(children, {
    className: cl(children.props.className, isActive ? then_ : else_),
  });
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
  return (
    <IfActive then="focus-permanent" path={path}>
      <div>
        {template.map((el) => {
          const label = el.label;
          const name =
            "id" in el ? el.id.slice(4) : "name" in el ? el.name : el.arg;
          const initialValue = values[name] ?? [];
          return (
            <RenderNestedField
              key={name}
              id={id}
              path={path}
              initialValue={initialValue}
              label={label}
              name={name}
              options={"options" in el ? el.options : undefined}
            />
          );
        })}
      </div>
    </IfActive>
  );
}

function RenderNestedField({
  path,
  label,
  labelColor,
  name,
  id,
  initialValue,
  options,
  icon: Icon = ChevronRightIcon,
}: {
  path: string;
  label: string;
  labelColor?: "blue";
  name: string | number;
  id: FieldId;
  initialValue: Computation;
  options?: any;
  icon?: React.FC<{ className?: string }>;
}) {
  return (
    <>
      <IfActive else="hidden" path={path}>
        <div
          className={cl(
            "text-sm flex items-center px-13 cursor-default",
            labelColor ? `text-sky-400/90` : "text-gray-400"
          )}
        >
          <div className="w-4 mx-5 flex-center opacity-60">
            <Icon className="w-4 h-4" />
          </div>
          {label}
        </div>
      </IfActive>
      <ParentProp label={label} name={`${name}`}>
        <WritableDefaultField
          id={id}
          path={extendPath(path, `${name}`, "/")}
          initialValue={initialValue}
          fieldConfig={{ type: "default" }}
          {...(options ? { options: options as string[] } : {})}
        />
      </ParentProp>
    </>
  );
}
