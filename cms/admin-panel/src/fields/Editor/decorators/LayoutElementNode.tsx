import React from "react";
import { LexicalNode, NodeKey } from "lexical";
import { useIsSelected } from "./useIsSelected";
import cl from "clsx";
import {
  FieldId,
  NestedDocumentId,
  NestedElement,
} from "@storyflow/backend/types";
import { getConfigFromType, useClientConfig } from "../../../client-config";
import { ChevronUpDownIcon, CubeIcon } from "@heroicons/react/24/outline";
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
import { flattenProps } from "../../../utils/flattenProps";
import { DefaultField } from "../../default/DefaultField";
import { computeFieldId, getIdFromString } from "@storyflow/backend/ids";

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

  const path = usePath();
  const [{ selectedPath, selectedDocument }, setPath] = useSelectedPath();
  const isOpen = selectedDocument === value.id;

  const { isSelected, select } = useIsSelected(nodeKey);

  const { libraries } = useClientConfig();
  const config = getConfigFromType(value.element, libraries);

  const libraryLabel = libraries.find(
    (el) => el.name === value.element.split(":")[0]
  )?.label;

  let props = flattenProps(value.id, config?.props ?? []);

  if (props.length) {
    props.push({
      name: "key",
      id: computeFieldId(value.id, getIdFromString("key")),
      label: "Generer liste",
      type: "string",
    });
  }

  return (
    <AttributesProvider>
      <EditorFocusProvider>
        <FocusContainer isOpen={isOpen} isSelected={isSelected}>
          <div
            className="flex items-center font-normal text-yellow-400/90 text-sm p-2.5 whitespace-nowrap"
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
            <CubeIcon className="w-4 h-4 mr-5 shrink-0" />
            {config?.label ?? value.element}
            <div className="overflow-x-auto no-scrollbar mx-2">
              <Attributes entity={value} hideAsDefault={!isTopLevel} />
            </div>
            <div className="ml-auto">
              <button
                className="w-5 h-5 flex-center rounded-full bg-gray-800 hover:bg-gray-700 transition-colors"
                onClick={() => {
                  setPath(() => [...selectedPath, ...path, value.id]);
                }}
              >
                <ChevronUpDownIcon className="w-4 h-4 rotate-45" />
              </button>
            </div>
          </div>
          <PrimaryProp documentId={value.id} props={props} />
        </FocusContainer>
      </EditorFocusProvider>
    </AttributesProvider>
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

function PrimaryProp({
  documentId,
  props,
}: {
  documentId: NestedDocumentId;
  props: (PropConfig<RegularOptions> & { id: FieldId })[];
}) {
  const [propId] = useAttributesContext();

  const config = props.find((el) => el.id === propId);

  if (!config) {
    return null;
  }

  return (
    <ExtendPath id={documentId} type="document">
      <ExtendPath id={config.id} type="field">
        <TopLevelContext.Provider key={config.id} value={false}>
          <FieldRestrictionsContext.Provider value={config.type}>
            <FieldOptionsContext.Provider
              value={"options" in config ? config.options ?? null : null}
            >
              <div className="cursor-auto pl-[2.875rem] pr-2.5 pb-2.5">
                <DefaultField id={config.id} showPromptButton />
              </div>
            </FieldOptionsContext.Provider>
          </FieldRestrictionsContext.Provider>
        </TopLevelContext.Provider>
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
