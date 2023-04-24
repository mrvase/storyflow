import React from "react";
import { $getRoot, $setSelection, LexicalNode, NodeKey } from "lexical";
import { useIsSelected } from "./useIsSelected";
import cl from "clsx";
import {
  FieldId,
  NestedDocumentId,
  NestedElement,
  SyntaxTree,
} from "@storyflow/backend/types";
import { getConfigFromType, useClientConfig } from "../../../client-config";
import {
  ArrowPathIcon,
  ArrowPathRoundedSquareIcon,
  ChevronUpDownIcon,
  CodeBracketSquareIcon,
  CubeIcon,
  EllipsisHorizontalIcon,
  WindowIcon,
} from "@heroicons/react/24/outline";
import {
  FieldRestrictionsContext,
  FieldOptionsContext,
} from "../../FieldIdContext";
import {
  EditorFocusProvider,
  useIsFocused,
} from "../../../editor/react/useIsFocused";
import { SerializedTokenStreamNode, TokenStreamNode } from "./TokenStreamNode";
import {
  Attributes,
  AttributesProvider,
  useAttributesContext,
} from "../../Attributes";
import { ExtendPath, usePath, useSelectedPath } from "../../Path";
import { PropConfig, RegularOptions } from "@storyflow/frontend/types";
import { flattenPropsWithIds } from "../../../utils/flattenProps";
import { DefaultField } from "../../default/DefaultField";
import { getIdFromString } from "@storyflow/backend/ids";
import { useEditorContext } from "../../../editor/react/EditorProvider";
import $createRangeSelection from "../../../editor/createRangeSelection";
import { useGlobalState } from "../../../state/state";
import { DEFAULT_SYNTAX_TREE } from "@storyflow/backend/constants";
import { tokens } from "@storyflow/backend/tokens";
import { traverseSyntaxTree } from "shared/computation-tools";

const LevelContext = React.createContext(0);

const LevelProvider = ({ children }: { children?: React.ReactNode }) => {
  return (
    <LevelContext.Provider value={React.useContext(LevelContext) + 1}>
      {children}
    </LevelContext.Provider>
  );
};

function Decorator({
  value,
  nodeKey,
}: {
  value: NestedElement;
  nodeKey: string;
}) {
  const isDeep = React.useContext(LevelContext) > 0;

  const isFocused = useIsFocused();

  const path = usePath();
  const [{ selectedPath, selectedDocument }, setPath] = useSelectedPath();
  const isOpen = selectedDocument === value.id;

  const { isSelected, select } = useIsSelected(nodeKey);

  const { libraries } = useClientConfig();
  const config = getConfigFromType(value.element, libraries);

  let props = flattenPropsWithIds(value.id, config?.props ?? []);

  const Icon =
    value.element === "Loop"
      ? ArrowPathRoundedSquareIcon
      : value.element === "Outlet"
      ? WindowIcon
      : CubeIcon;

  const firstIsChildren = props[0]?.type === "children";

  const hide = isDeep && firstIsChildren;

  return (
    <AttributesProvider>
      <EditorFocusProvider>
        <FocusContainer isOpen={isOpen} isSelected={isSelected}>
          <div
            className={cl(
              "flex items-center font-medium text-sm p-2.5 whitespace-nowrap",
              value.element.indexOf(":") > 0
                ? "text-yellow-400"
                : "text-red-400"
            )}
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
            <InterSelectionArea nodeKey={nodeKey} />
            <Icon className="w-4 h-4 mr-5 shrink-0" />
            {config?.label ?? value.element}
            <div className="overflow-x-auto no-scrollbar mx-3">
              <Attributes
                entity={value}
                hideAsDefault={hide}
                color={value.element.indexOf(":") > 0 ? "yellow" : "red"}
              />
            </div>
            <div className="ml-auto">
              <button
                tabIndex={-1}
                className="w-5 h-5 flex-center rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 transition-colors"
                onClick={() => {
                  setPath(() => [...selectedPath, ...path, value.id]);
                }}
              >
                <ChevronUpDownIcon className="w-4 h-4 rotate-45" />
              </button>
            </div>
          </div>
          <FieldSpecification props={props} isLoop={value.element === "Loop"}>
            <NestedDefaultField
              documentId={value.id}
              ellipsis={props.length > 0}
            />
          </FieldSpecification>
        </FocusContainer>
      </EditorFocusProvider>
    </AttributesProvider>
  );
}

function InterSelectionArea({ nodeKey }: { nodeKey: string }) {
  const editor = useEditorContext();

  return (
    <div
      className="absolute h-3 -top-3 inset-x-0 cursor-text"
      onMouseDown={(ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        editor.update(() => {
          const node = $getRoot();
          const offset = node
            .getChildren()
            .findIndex((el) => el.getKey() === nodeKey);
          if (offset < 0) return;
          const selection = $createRangeSelection(
            {
              node,
              offset,
              type: "element",
            },
            {
              node,
              offset,
              type: "element",
            }
          );
          editor.getRootElement()?.focus();
          $setSelection(selection);
        });
      }}
    />
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
  } else if (isFocused) {
    ring = "ring-1 dark:ring-gray-600";
  } else {
    ring = "ring-1 ring-gray-200 dark:ring-gray-700";
  }

  return (
    <div
      className={cl(
        "relative cursor-default",
        "rounded",
        ring,
        "bg-white dark:bg-gray-850", // isFocused ? "bg-gray-50 dark:bg-gray-800" :
        "transition-[background-color,box-shadow]"
      )}
    >
      {children}
    </div>
  );
}

function useParentPropConfig() {
  const [{ selectedPath }] = useSelectedPath();
  const path = usePath();
  const fullPath = React.useMemo(
    () => [...selectedPath, ...path],
    [selectedPath, path]
  );
  const parentFieldId = fullPath[fullPath.length - 3];
  const documentId = fullPath[fullPath.length - 2] as NestedDocumentId;
  const fieldId = fullPath[fullPath.length - 1];
  let element: string | undefined;
  traverseSyntaxTree(
    useGlobalState<SyntaxTree>(`${parentFieldId}#tree`)[0] ??
      DEFAULT_SYNTAX_TREE,
    (item) => {
      if (tokens.isNestedElement(item) && item.id === documentId) {
        element = item.element;
      }
    }
  );
  const { libraries } = useClientConfig();
  const config = element ? getConfigFromType(element, libraries) : undefined;
  if (!config) return;
  return flattenPropsWithIds(documentId, config.props).find(
    (el) => el.id === fieldId
  );
}

function FieldSpecification({
  props,
  isLoop,
  children,
}: {
  props: (PropConfig<RegularOptions> & { id: FieldId })[];
  isLoop: boolean;
  children: React.ReactNode;
}) {
  const [propId] = useAttributesContext();
  const parentPropConfig = useParentPropConfig();

  if (!propId) {
    return <>{children}</>;
  }

  const config = props.find((el) => el.id === propId)!;

  let options: RegularOptions | undefined =
    "options" in config ? config.options : undefined;

  if (isLoop) {
    options = parentPropConfig?.options;
  }

  return (
    <LevelProvider key={propId}>
      <FieldRestrictionsContext.Provider value={config.type}>
        <FieldOptionsContext.Provider value={options ?? null}>
          {children}
        </FieldOptionsContext.Provider>
      </FieldRestrictionsContext.Provider>
    </LevelProvider>
  );
}

function NestedDefaultField({
  documentId,
  ellipsis,
}: {
  documentId: NestedDocumentId;
  ellipsis?: boolean;
}) {
  const [propId] = useAttributesContext();

  if (!propId) {
    return ellipsis ? (
      <div className="text-gray-400 pl-11 -mt-2 pb-1 pointer-events-none">
        <EllipsisHorizontalIcon className="w-4 h-4" />
      </div>
    ) : null;
  }

  return (
    <ExtendPath id={documentId} type="document">
      <ExtendPath id={propId} type="field">
        <div className="cursor-auto pl-[2.875rem] pr-2.5">
          <DefaultField
            id={propId}
            showPromptButton
            showTemplateHeader={propId.endsWith(getIdFromString("data"))}
          />
        </div>
      </ExtendPath>
    </ExtendPath>
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

  createDOM(): HTMLElement {
    const element = document.createElement("div");
    element.setAttribute(`data-lexical-${this.__type}`, "true");
    element.setAttribute(`style`, "min-height: 42px;");
    return element;
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
