import React from "react";
import { LexicalNode, NodeKey } from "lexical";
import { useIsSelected } from "./useIsSelected";
import cl from "clsx";
import { FieldId, NestedElement, ValueArray } from "@storyflow/backend/types";
import { useParentProp } from "../default/ParentPropContext";
import { NestedPortal, useBuilderPath } from "../BuilderPath";
import { getConfigFromType, useClientConfig } from "../../client-config";
import { WritableDefaultField } from "../default/RenderNestedFields";
import {
  ChevronUpDownIcon,
  CubeIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { computeFieldId, getIdFromString } from "@storyflow/backend/ids";
import { DEFAULT_SYNTAX_TREE } from "@storyflow/backend/constants";
import { useDocumentPageContext } from "../../documents/DocumentPageContext";
import { PropConfig, RegularOptions } from "@storyflow/frontend/types";
import { FieldOptionsContext } from "../default/FieldOptionsContext";
import { FieldRestrictionsContext } from "../FieldTypeContext";
import { useGlobalState } from "../../state/state";
import { calculateFn } from "../default/calculateFn";
import { useFieldId } from "../FieldIdContext";
import { useClient } from "../../client";
import { extendPath } from "@storyflow/backend/extendPath";
import {
  EditorFocusProvider,
  useIsFocused,
} from "../../editor/react/useIsFocused";
import { SerializedTokenStreamNode, TokenStreamNode } from "./TokenStreamNode";

const TopLevelContext = React.createContext(true);

function Decorator({
  value,
  nodeKey,
}: {
  value: NestedElement;
  nodeKey: string;
}) {
  const isTopLevel = React.useContext(TopLevelContext);

  const isFocused = useIsFocused();

  const [path, setPath] = useBuilderPath();

  const isOpen = path[path.length - 1]?.id === value.id;

  const parentProp = useParentProp();

  const { isSelected, select } = useIsSelected(nodeKey);

  const { libraries } = useClientConfig();
  const config = getConfigFromType(value.element, libraries);

  const libraryLabel = libraries.find(
    (el) => el.name === value.element.split(":")[0]
  )?.label;

  const flatProps = React.useMemo(
    () =>
      (config?.props ?? []).reduce(
        (acc, el) =>
          el.type === "group"
            ? [
                ...acc,
                ...el.props.map((nested) => ({
                  id: computeFieldId(
                    value.id,
                    getIdFromString(extendPath(el.name, nested.label, "#"))
                  ),
                  ...nested,
                  label: `${el.name} (${nested.label})`,
                })),
              ]
            : [
                ...acc,
                {
                  id: computeFieldId(value.id, getIdFromString(el.name)),
                  ...(el as PropConfig<RegularOptions>),
                },
              ],
        [] as (PropConfig<RegularOptions> & { id: FieldId })[]
      ),
    [config?.props, value.id]
  );

  const [currentProp, setCurrentProp] = React.useState<
    (typeof flatProps)[number] | undefined
  >(isTopLevel ? flatProps[0] : undefined);

  return (
    <EditorFocusProvider>
      <NestedPortal id={value.id}>
        <FocusContainer isOpen={isOpen} isSelected={isSelected}>
          <div
            className="flex items-center font-normal text-yellow-400/90 text-sm p-2.5"
            onMouseDown={(ev) => {
              // preventDefault added because it prevents a conflict with lexical
              // which sets the selection as well, overwriting the selection set here.
              // This happens only when the editor is first selected without a cursor,
              // and you then click the element.
              if (!isSelected) {
                if (isFocused) {
                  ev.preventDefault();
                }
                select();
              }
            }}
          >
            <CubeIcon className="w-4 h-4 mr-5" />
            {isOpen && (
              <span className="text-gray-400">
                <button
                  className="hover:underline"
                  onClick={() => {
                    setPath(() => []);
                  }}
                >
                  Side
                </button>
                <span className="opacity-50 mx-2">&gt;</span>
              </span>
            )}
            {config?.label ?? value.element}
            {(flatProps ?? []).map((el) => (
              <PropPreview
                key={el.id}
                prop={el}
                selected={currentProp === el}
                select={(toggle) => setCurrentProp(toggle ? el : undefined)}
              />
            ))}
            <div className="ml-auto">
              <button
                className="w-5 h-5 flex-center rounded-full bg-gray-800 hover:bg-gray-700 transition-colors"
                onClick={() => {
                  if (isOpen) {
                    setPath([]);
                  } else {
                    setPath((ps) => [
                      ...ps,
                      {
                        id: value.id,
                        element: value.element,
                        parentProp: parentProp,
                      },
                    ]);
                  }
                }}
              >
                {isOpen ? (
                  <XMarkIcon className="w-3.5 h-3.5" />
                ) : (
                  <ChevronUpDownIcon className="w-4 h-4 rotate-45" />
                )}
              </button>
            </div>
          </div>
          {/*<button className="group h-full px-2 hover:bg-white/5 flex-center gap-1 rounded cursor-default transition-colors">
          {component.label ?? value.type}{" "}
          <ChevronDownIcon className="w-3 h-3 opacity-0 group-hover:opacity-75 transition-opacity" />
      </button>*/}
          {currentProp && (
            <div className="cursor-auto pt-0.5 pb-2.5">
              <PrimaryProp key={currentProp.id} prop={currentProp} />
            </div>
          )}
        </FocusContainer>
      </NestedPortal>
    </EditorFocusProvider>
  );
}

function FocusContainer({
  children,
  isOpen,
  isSelected,
}: {
  children: React.ReactNode;
  isOpen: boolean;
  isSelected: boolean;
}) {
  const isFocused = useIsFocused();

  let ring = "";

  if (isOpen) {
    ring = "ring-1 dark:ring-yellow-200/50";
  } else if (isSelected) {
    ring = "ring-1 dark:ring-gray-200";
  } else {
    ring = "ring-1 ring-gray-200 dark:ring-gray-700";
  }

  return (
    <div
      className={cl(
        "relative cursor-default",
        "rounded selection:bg-transparent",
        ring,
        isFocused ? "bg-gray-800" : "bg-gray-850",
        "transition-[background-color,box-shadow]"
      )}
    >
      {children}
    </div>
  );
}

function PropPreview({
  prop,
  selected,
  select,
}: {
  prop: PropConfig<RegularOptions> & { id: FieldId };
  selected: boolean;
  select: (value: boolean) => void;
}) {
  const rootId = useFieldId();
  const client = useClient();
  const { record } = useDocumentPageContext();
  const initialValue = record[prop.id] ?? DEFAULT_SYNTAX_TREE;

  const [output] = useGlobalState<ValueArray>(prop.id, () =>
    calculateFn(rootId, initialValue, { record, client })
  );

  const preview = ["number", "string"].includes(typeof output[0])
    ? (output[0] as string)
    : "";

  return (
    <div
      className={cl(
        "rounded-full flex items-center border px-2 ml-2 font-light text-xs transition-colors",
        selected
          ? "border-gray-600 text-gray-500"
          : "border-gray-750 text-gray-700 hover:border-gray-600 hover:text-gray-500"
      )}
      onMouseDown={(ev) => {
        select(!selected);
        ev.stopPropagation();
      }}
    >
      <span className="font-normal">
        {prop.label}
        {preview ? ": " : ""}
      </span>
      <span className="text-gray-500">{preview}</span>
    </div>
  );
}

function PrimaryProp({
  prop,
}: {
  prop: PropConfig<RegularOptions> & { id: FieldId };
}) {
  const { record } = useDocumentPageContext();
  return (
    <TopLevelContext.Provider value={false}>
      <FieldRestrictionsContext.Provider value={prop.type}>
        <FieldOptionsContext.Provider
          value={"options" in prop ? prop.options ?? null : null}
        >
          <WritableDefaultField
            id={prop.id}
            initialValue={record[prop.id] ?? DEFAULT_SYNTAX_TREE}
            fieldConfig={{ type: "default" }}
            hidden={false}
          />
        </FieldOptionsContext.Provider>
      </FieldRestrictionsContext.Provider>
    </TopLevelContext.Provider>
  );
}

const type = "layout-element";
type TokenType = NestedElement;

export default class ChildNode extends TokenStreamNode<typeof type, TokenType> {
  static getType(): string {
    return type;
  }

  static clone(node: ChildNode): ChildNode {
    return new ChildNode(node.__token, node.__key);
  }

  constructor(token: TokenType, key?: NodeKey) {
    super(type, token, key);
  }

  exportJSON(): SerializedTokenStreamNode<typeof type, TokenType> {
    return super.exportJSON();
  }

  static importJSON(
    serializedNode: SerializedTokenStreamNode<typeof type, TokenType>
  ) {
    return new ChildNode(serializedNode.token);
  }

  decorate(): React.ReactNode {
    return <Decorator nodeKey={this.__key} value={this.__token} />;
  }
}

export function $createLayoutElementNode(value: TokenType): ChildNode {
  return new ChildNode(value);
}

export function $isLayoutElementNode(node: LexicalNode): node is ChildNode {
  return node instanceof ChildNode;
}
