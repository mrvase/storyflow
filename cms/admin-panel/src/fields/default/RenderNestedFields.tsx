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
import { stringifyPath, useBuilderPath } from "../BuilderPath";
import { getConfigFromType, useClientConfig } from "../../client-config";
import { useClient } from "../../client";
import { ParentProp, WritableDefaultField } from "./DefaultField";
import { useFieldTemplate } from "./useFieldTemplate";
import { calculateFn, fetchFn } from "./calculateFn";
import {
  PropConfig,
  PropGroup,
  RegularOptions,
} from "@storyflow/frontend/types";
import { FieldOptionsContext } from "./FieldOptionsContext";
import { FieldRestrictionsContext } from "../FieldTypeContext";
import { useDocumentPageContext } from "../../documents/DocumentPageContext";
import Select from "../../elements/Select";
import { getTemplateFieldId } from "@storyflow/backend/ids";

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
  const [, setPath] = useBuilderPath();

  const [fetcher, _setFetcher] = React.useState(currentFetcher);
  const [isModified, setIsModified] = React.useState(false);
  const setFetcher: typeof _setFetcher = (value) => {
    setIsModified(true);
    _setFetcher(value);
  };

  const client = useClient();

  const [, setOutput] = useGlobalState<NestedDocument[]>(
    extendPath(id, path),
    () => fetchFn(extendPath(id, path), { ...fetcher }, client)
  );

  return (
    <IfActive path={path} then="pb-5 focus-permanent" else="hidden">
      <div className="w-full flex flex-col items-start gap-5">
        {fetcher.filters.map((filter, index) => (
          <FilterComp
            key={index}
            id={id}
            path={extendPath(path, `${index}`, "/")}
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
          className="flex items-center text-xs opacity-25 hover:opacity-100 transition-opacity cursor-default"
        >
          <div className="w-4 mx-5 flex-center px-13 h-5">
            <PlusIcon className="w-4 h-4" />
          </div>
          TILFØJ FILTER
        </div>
        <button
          className={cl(
            "bg-teal-600 rounded px-3 py-1.5 ml-14 text-sm font-light hover:bg-teal-500 transition-colors",
            !isModified && "opacity-50"
          )}
          onClick={() => {
            if (isModified) {
              setOutput(() =>
                fetchFn(extendPath(id, path), { ...fetcher }, client)
              );
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
  path,
}: {
  id: FieldId;
  setFetcher: (callback: (ps: Fetcher) => Fetcher) => void;
  index: number;
  filter: Filter;
  path: string;
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

  const { imports } = useDocumentPageContext();
  const client = useClient();

  const [value, setValueOutput] = useGlobalState<Value[]>(
    extendPath(id, path),
    () => calculateFn(id, filter.value, { imports, client })
  );

  const setValue = React.useCallback((value: () => EditorComputation) => {
    const decoded = decodeEditorComputation(value());
    setFilterValue("value", decoded);
    setValueOutput(() => calculateFn(id, decoded, { client, imports }));
  }, []);

  const template = useFieldTemplate(id) ?? [];

  const options = React.useMemo(() => {
    const options = template.map((el) => {
      return {
        label: el.label,
        value: getTemplateFieldId(el.id) as string,
      };
    });

    options.unshift({
      label: "Mappe",
      value: "folder",
    });

    return options;
  }, [template]);

  const operations = ["=", "!=", ">", ">=", "<", "<="] as const;

  const operationsLabel = {
    "=": "=",
    "!=": "≠",
    ">": ">",
    ">=": "≥",
    "<": "<",
    "<=": "≤",
  };

  return (
    <div className="w-full flex items-start pr-5">
      <div
        className="w-4 mx-5 flex-center opacity-25 hover:opacity-100 transition-opacity px-13 h-5"
        onClick={() => {
          setFetcher((ps) => ({
            ...ps,
            filters: ps.filters.filter((el) => el !== filter),
          }));
        }}
      >
        <XMarkIcon className="w-4 h-4" />
      </div>
      <div className="w-full flex gap-3">
        <div className="w-1/3">
          <div
            className={cl(
              "text-sm opacity-50 flex items-center cursor-default mb-1"
            )}
          >
            Felt
          </div>
          <Select
            value={filter.field}
            setValue={(value: string) => setFilterValue("field", value)}
            options={options}
          />
        </div>
        <div className="w-1/3">
          <div
            className={cl(
              "text-sm opacity-50 flex items-center cursor-default mb-1"
            )}
          >
            Operation
          </div>
          <div className="rounded ring-button overflow-x-auto no-scrollbar">
            <div className="relative flex h-8">
              <div
                className="absolute left-0 shrink-0 h-8 w-8 ring-1 ring-inset rounded ring-yellow-300 transition-transform"
                style={{
                  transform: `translateX(${
                    2 * operations.indexOf(filter.operation as any)
                  }rem)`,
                }}
              />
              {operations.map((el) => (
                <div
                  className={cl(
                    "shrink-0 h-8 w-8 flex-center text-sm font-light cursor-default transition-opacity",
                    el === filter.operation
                      ? "opacity-100"
                      : "opacity-50 hover:opacity-100"
                  )}
                  onClick={() => setFilterValue("operation", el)}
                >
                  {operationsLabel[el]}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="w-1/3">
          <div
            className={cl(
              "text-sm opacity-50 flex items-center cursor-default mb-1"
            )}
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
                  "peer grow editor outline-none py-1 px-1.5 rounded font-light selection:bg-gray-700 ring-button",
                  "preview text-base leading-4"
                  // mode === null || mode === "slug" ? "calculator" : ""
                )}
              />
            </div>
          </Editor>
        </div>
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
  const [fullPath, setPath] = useBuilderPath();

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

  const config = getConfigFromType(type, libraries);

  const initialProps = config?.props ?? [];

  const [key] = useGlobalState<Value[]>(extendPath(id, `${path}/key`));

  const [listIsOpen_, toggleListIsOpen] = React.useReducer((ps) => !ps, false);
  React.useEffect(() => {
    if (!listIsOpen_ && (key?.length ?? 0) > 0) {
      console.log("SET IS OPEN");
      toggleListIsOpen();
    }
  }, [listIsOpen_, key]);

  const listIsOpen = listIsOpen_ || (key?.length ?? 0) > 0;

  const [tab, setTab] = React.useState(0);

  const props = initialElement?.props ?? {};

  const groups = initialProps.filter(
    (el): el is PropGroup<RegularOptions> => el.type === "group"
  );

  const leftoverProps = initialProps.filter(
    (el): el is PropConfig<RegularOptions> => el.type !== "group"
  );

  const hasLeftoverGroup = Boolean(leftoverProps.length && groups.length);

  const tabs = ["Egenskaber", ...groups.map((el) => el.label)];

  const isActive = useIsActive(path);

  return (
    <>
      <div className={!isActive ? "hidden" : ""}>
        <div className="pb-5 text-gray-300 text-sm flex items-center">
          <div className="mx-5 w-4">
            <button
              className="w-4 h-4 rounded-full bg-gray-700 hover:scale-150 hover:bg-gray-600 flex-center transition-[transform,colors]"
              onClick={() => setPath((ps) => ps.slice(0, -1))}
            >
              <ChevronLeftIcon className="w-3 h-3" />
            </button>
          </div>
          {config?.label}
          <button
            className="ml-auto mr-5 w-4 h-4 flex-center rounded-full bg-gray-700"
            onClick={toggleListIsOpen}
          >
            <Bars3Icon className="w-3 h-3" />
          </button>
        </div>
      </div>
      <div className={!listIsOpen || !isActive ? "hidden" : ""}>
        <RenderNestedField
          id={id}
          hidden={!isActive || !listIsOpen}
          path={path}
          initialValue={props["key"] ?? []}
          label={"Lav til liste"}
          labelColor="blue"
          icon={Bars3Icon}
          name="key"
        />
      </div>
      {tabs.length > 1 && (
        <div className={cl("pl-14 mb-5 flex gap-2", !isActive && "hidden")}>
          {tabs.map((label, index) => {
            if (index === 0 && !hasLeftoverGroup) return null;
            return (
              <button
                onClick={() => setTab(index)}
                className={cl(
                  tab !== index
                    ? "bg-button ring-button text-button"
                    : "ring-1 bg-button ring-yellow-400",
                  "rounded px-3 py-1.5 text-sm font-light"
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}
      <RenderNestedFields
        id={id}
        hidden={!isActive || tab !== 0}
        path={path}
        values={props}
        template={leftoverProps}
      />
      {groups.map((group, index) => (
        <RenderNestedFields
          id={id}
          hidden={!isActive || tab !== index + 1}
          path={path}
          values={props}
          template={group.props}
          group={group.name}
        />
      ))}
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

  const isActive = useIsActive(path);

  return (
    <RenderNestedFields
      id={id}
      hidden={!isActive}
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

  const isActive = useIsActive(path);

  return (
    <RenderNestedFields
      id={id}
      hidden={!isActive}
      path={path}
      values={initialImport?.args ?? {}}
      template={[{ arg: 0, label: "Parameter 1" }]}
    />
  );
}

function useIsActive(path: string) {
  const [fullPath] = useBuilderPath();
  return stringifyPath(fullPath) === path;
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
  const [fullPath] = useBuilderPath();
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
  group,
  hidden,
}: {
  id: FieldId;
  path: string;
  values: Record<string, Computation>;
  template:
    | ({ arg: number; label: string } | { id: string; label: string })[]
    | readonly PropConfig<RegularOptions>[];
  hidden: boolean;
  group?: string;
}) {
  return (
    <IfActive then="focus-permanent" path={path}>
      <div>
        {template.map((el) => {
          const label = el.label;
          let name =
            "id" in el ? el.id.slice(4) : "name" in el ? el.name : el.arg;
          name = group ? extendPath(group, String(name), "#") : name;
          const initialValue = values[name] ?? [];

          const field = (
            <RenderNestedField
              key={name}
              id={id}
              path={path}
              initialValue={initialValue}
              label={label}
              name={name}
              hidden={hidden}
            />
          );

          if ("type" in el) {
            return (
              <FieldRestrictionsContext.Provider value={el.type}>
                <FieldOptionsContext.Provider
                  value={"options" in el ? el.options ?? null : null}
                >
                  {field}
                </FieldOptionsContext.Provider>
              </FieldRestrictionsContext.Provider>
            );
          }

          return field;
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
  hidden,
  icon: Icon = ChevronRightIcon,
}: {
  path: string;
  label: string;
  labelColor?: "blue";
  name: string | number;
  id: FieldId;
  initialValue: Computation;
  hidden: boolean;
  icon?: React.FC<{ className?: string }>;
}) {
  return (
    <>
      <div
        className={cl(
          "text-sm flex items-center px-13 cursor-default pb-1.5",
          labelColor ? `text-sky-400/90` : "text-gray-400",
          hidden && "hidden"
        )}
      >
        <div className="w-4 mx-5 flex-center opacity-60">
          <Icon className="w-4 h-4" />
        </div>
        {label}
      </div>
      <ParentProp name={`${name}`}>
        <WritableDefaultField
          id={id}
          path={extendPath(path, `${name}`, "/")}
          initialValue={initialValue}
          fieldConfig={{ type: "default" }}
          hidden={hidden}
        />
      </ParentProp>
    </>
  );
}
