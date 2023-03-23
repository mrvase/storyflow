import React from "react";
import { useGlobalState } from "../../state/state";
import cl from "clsx";
import {
  FieldId,
  NestedDocumentId,
  RawFieldId,
  FieldConfig,
  FieldType,
  SyntaxTreeRecord,
  SyntaxTree,
  ValueArray,
} from "@storyflow/backend/types";
import {
  Bars3Icon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline";
import { extendPath } from "@storyflow/backend/extendPath";
import { stringifyPath, useBuilderPath } from "../BuilderPath";
import { getConfigFromType, useClientConfig } from "../../client-config";
import { ParentProp, WritableDefaultField } from "./DefaultField";
import { useFieldTemplate } from "./useFieldTemplate";
import {
  PropConfig,
  PropGroup,
  RegularOptions,
} from "@storyflow/frontend/types";
import { FieldOptionsContext } from "./FieldOptionsContext";
import { FieldRestrictionsContext } from "../FieldTypeContext";
import {
  computeFieldId,
  createRawTemplateFieldId,
  createTemplateFieldId,
  getDocumentId,
  getIdFromString,
  replaceDocumentId,
} from "@storyflow/backend/ids";
import { useFieldId } from "../FieldIdContext";
import { useDocumentPageContext } from "../../documents/DocumentPageContext";
import { DEFAULT_SYNTAX_TREE } from "@storyflow/backend/constants";

const noTemplate: FieldConfig<FieldType>[] = [];

export function RenderFolder({
  nestedDocumentId,
}: {
  nestedDocumentId: NestedDocumentId;
}) {
  const id = useFieldId();
  const template = useFieldTemplate(id) ?? noTemplate;

  const isActive = useIsActive(nestedDocumentId);

  const { record } = useDocumentPageContext();

  const values: SyntaxTreeRecord = React.useMemo(() => {
    return Object.fromEntries(
      template.map((el) => {
        const id = createTemplateFieldId(nestedDocumentId, el.id);
        return [id, record[id] ?? DEFAULT_SYNTAX_TREE];
      })
    );
  }, [template, record]);

  const [, setTemplate] = useGlobalState(`${nestedDocumentId}#template`, () =>
    template.map((el) => el.id)
  );

  const prevTemplate = React.useRef(template);

  React.useEffect(() => {
    if (template !== prevTemplate.current) {
      setTemplate(() => template.map((el) => el.id));
    }
  }, [template]);

  return (
    <RenderNestedFields
      nestedDocumentId={nestedDocumentId}
      hidden={!isActive}
      values={values}
      template={template}
    />
  );
}

export function RenderNestedElement({
  nestedDocumentId,
  element,
}: {
  nestedDocumentId: NestedDocumentId;
  element: string;
}) {
  const [, setPath] = useBuilderPath();
  const { libraries } = useClientConfig();

  const config = getConfigFromType(element, libraries);

  const initialProps = config?.props ?? [];

  const { record } = useDocumentPageContext();

  const values = React.useMemo(() => {
    return Object.fromEntries(
      initialProps.reduce((acc, prop) => {
        if (prop.type === "group") {
          const props = prop.props.map((innerProp) => {
            const id = computeFieldId(
              nestedDocumentId,
              getIdFromString(extendPath(prop.name, innerProp.name, "#"))
            );
            return [id, record[id] ?? DEFAULT_SYNTAX_TREE] as [
              FieldId,
              SyntaxTree
            ];
          });
          acc.push(...props);
        } else {
          const id = computeFieldId(
            nestedDocumentId,
            getIdFromString(prop.name)
          );
          acc.push([id, record[id] ?? DEFAULT_SYNTAX_TREE]);
        }
        return acc;
      }, [] as [FieldId, SyntaxTree][])
    ) as SyntaxTreeRecord;
  }, [initialProps, record]);

  const keyId = computeFieldId(nestedDocumentId, getIdFromString("key"));
  const [key] = useGlobalState<ValueArray>(keyId);

  console.log("KEY KEY KEY", key);

  const [listIsOpen_, toggleListIsOpen] = React.useReducer((ps) => !ps, false);

  React.useEffect(() => {
    if (!listIsOpen_ && (key?.length ?? 0) > 0) {
      console.log("SET IS OPEN");
      toggleListIsOpen();
    }
  }, [listIsOpen_, key]);

  const listIsOpen = listIsOpen_ || (key?.length ?? 0) > 0;

  const [tab, setTab] = React.useState(0);

  const groups = initialProps.filter(
    (el): el is PropGroup<RegularOptions> => el.type === "group"
  );

  const leftoverProps = initialProps.filter(
    (el): el is PropConfig<RegularOptions> => el.type !== "group"
  );

  const hasLeftoverGroup = Boolean(leftoverProps.length && groups.length);

  const tabs = ["Egenskaber", ...groups.map((el) => el.label)];

  const isActive = useIsActive(nestedDocumentId);

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
        <ParentProp name="key">
          <RenderNestedField
            nestedFieldId={keyId}
            hidden={!isActive || !listIsOpen}
            initialValue={record[keyId] ?? DEFAULT_SYNTAX_TREE}
            label={"Lav til liste"}
            labelColor="blue"
            icon={Bars3Icon}
          />
        </ParentProp>
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
        nestedDocumentId={nestedDocumentId}
        hidden={!isActive || tab !== 0}
        values={values}
        template={leftoverProps}
      />
      {groups.map((group, index) => (
        <RenderNestedFields
          nestedDocumentId={nestedDocumentId}
          hidden={!isActive || tab !== index + 1}
          values={values}
          template={group.props}
          group={group.name}
        />
      ))}
    </>
  );
}
export function RenderNestedDocument({
  nestedDocumentId,
}: {
  nestedDocumentId: NestedDocumentId;
}) {
  const id = useFieldId();
  const template = useFieldTemplate(id) ?? [];

  const isActive = useIsActive(nestedDocumentId);

  const { record } = useDocumentPageContext();

  const values: SyntaxTreeRecord = React.useMemo(() => {
    return Object.fromEntries(
      template.map((el) => {
        const id = replaceDocumentId(el.id, nestedDocumentId);
        return [id, record[id] ?? DEFAULT_SYNTAX_TREE];
      })
    );
  }, [template, record]);

  return (
    <RenderNestedFields
      nestedDocumentId={nestedDocumentId}
      hidden={!isActive}
      values={values}
      template={template}
    />
  );
}

export function RenderImportArgs({
  nestedDocumentId,
}: {
  nestedDocumentId: NestedDocumentId;
}) {
  const isActive = useIsActive(nestedDocumentId);

  return (
    <RenderNestedFields
      nestedDocumentId={nestedDocumentId}
      hidden={!isActive}
      values={{}}
      template={[{ arg: 0, label: "Parameter 1" }]}
    />
  );
}

function useIsActive(nestedDocumentId: NestedDocumentId) {
  const [fullPath] = useBuilderPath();
  const last = fullPath[fullPath.length - 1];
  return last && last.id === nestedDocumentId;
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
  nestedDocumentId,
  values,
  template,
  group,
  hidden,
}: {
  nestedDocumentId: NestedDocumentId;
  values: SyntaxTreeRecord;
  template:
    | ({ arg: number; label: string } | { id: FieldId; label: string })[]
    | readonly PropConfig<RegularOptions>[];
  hidden: boolean;
  group?: string;
}) {
  return (
    <IfActive then="focus-permanent" path={nestedDocumentId}>
      <div>
        {template.map((el) => {
          const label = el.label;
          let rawFieldId =
            "id" in el
              ? createRawTemplateFieldId(el.id)
              : "name" in el
              ? getIdFromString(extendPath(group ?? "", el.name, "#"))
              : (`${el.arg}`.padStart(12, "0") as RawFieldId);

          const fieldId = computeFieldId(nestedDocumentId, rawFieldId);

          const initialValue = values[fieldId] ?? DEFAULT_SYNTAX_TREE;

          const field = (
            <RenderNestedField
              key={fieldId}
              nestedFieldId={fieldId}
              initialValue={initialValue}
              label={label}
              hidden={hidden}
            />
          );

          if ("type" in el) {
            return (
              <FieldRestrictionsContext.Provider key={fieldId} value={el.type}>
                <FieldOptionsContext.Provider
                  value={"options" in el ? el.options ?? null : null}
                >
                  <ParentProp name={el.name}>{field}</ParentProp>
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
  nestedFieldId,
  label,
  labelColor,
  initialValue,
  hidden,
  icon: Icon = ChevronRightIcon,
}: {
  nestedFieldId: FieldId;
  label: string;
  labelColor?: "blue";
  initialValue: SyntaxTree;
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
      <WritableDefaultField
        id={nestedFieldId}
        initialValue={initialValue}
        fieldConfig={{ type: "default" }}
        hidden={hidden}
      />
    </>
  );
}
