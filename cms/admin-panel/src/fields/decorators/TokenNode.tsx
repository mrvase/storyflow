import React from "react";
import {
  DecoratorNode,
  DOMConversionMap,
  DOMConversionOutput,
  DOMExportOutput,
  LexicalNode,
  NodeKey,
  SerializedLexicalNode,
  Spread,
} from "lexical";
import cl from "clsx";
import {
  ColorToken,
  CustomToken,
  FileToken,
  Token,
} from "@storyflow/backend/types";
import { useIsSelected } from "./useIsSelected";
import { caretClasses } from "./caret";
import {
  PhotoIcon,
  SwatchIcon,
  TagIcon,
  VariableIcon,
} from "@heroicons/react/24/outline";
import { useFileLabel } from "../../files";
import { useFieldOptions } from "../default/OptionsContext";
import { Option, RegularOptions } from "@storyflow/frontend/types";
import useSWR from "swr";
import { getColorName, hexColorToRgb, isHexColor } from "../../utils/colors";

/*
export const getTokenType = (value: TokenString) => {
  if (value.match(/^#[0-9a-fA-F]+$/)) {
    return "color";
  }
  if (value.match(/\.(png|jpg|jpeg|mp4|mov)$/)) {
    return "file";
  }
  if (value.match(/\.(png|jpg|jpeg|mp4|mov)$/)) {
    return "file";
  }
};
*/

function TokenDecorator({ nodeKey, token }: { nodeKey: string; token: Token }) {
  if ("color" in token) {
    return <ColorDecorator nodeKey={nodeKey} token={token} />;
  }
  if ("name" in token) {
    return <CustomDecorator nodeKey={nodeKey} token={token} />;
  }
  return <FileDecorator nodeKey={nodeKey} token={token} />;
}

function CustomDecorator({
  nodeKey,
  token,
}: {
  nodeKey: string;
  token: CustomToken;
}) {
  const { data } = useSWR("COLORS", {
    revalidateOnMount: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
  });

  const { isSelected, isPseudoSelected, select } = useIsSelected(nodeKey);
  const selectClick = React.useRef(false);

  const options = useFieldOptions();

  const option = (options as Option[]).find(
    (option): option is { name: string; label?: string } =>
      typeof option === "object" && option.name === token.name
  );

  let label = option && "label" in option ? option.label : token.name;

  if (data && option && "value" in option && isHexColor(option.value)) {
    label += ` (${getColorName(option.value.slice(1), data[0], data[1])})`;
  }

  return (
    <span
      className={cl(
        "bg-gray-50 dark:bg-sky-400/20 text-sky-100/90 rounded-sm selection:bg-transparent relative px-2",
        isSelected ? "ring-1 ring-amber-300" : "dark:ring-gray-600",
        isPseudoSelected && caretClasses
      )}
      onMouseDown={() => {
        if (!isSelected) {
          select();
          selectClick.current = true;
        }
      }}
    >
      <span className="flex-center gap-2">
        <TagIcon className="w-4 h-4 inline" />
        {label}
      </span>
    </span>
  );
}

function FileDecorator({
  nodeKey,
  token,
}: {
  nodeKey: string;
  token: FileToken;
}) {
  const { isSelected, isPseudoSelected, select } = useIsSelected(nodeKey);
  const selectClick = React.useRef(false);

  const label = useFileLabel(token.src);

  return (
    <span
      className={cl(
        "bg-gray-50 dark:bg-sky-400/20 text-sky-100/90 rounded-sm selection:bg-transparent relative px-2",
        isSelected ? "ring-1 ring-amber-300" : "dark:ring-gray-600",
        isPseudoSelected && caretClasses
      )}
      onMouseDown={() => {
        if (!isSelected) {
          select();
          selectClick.current = true;
        }
      }}
    >
      <span className="flex-center gap-2">
        <PhotoIcon className="w-4 h-4 inline" />
        {label}
      </span>
    </span>
  );
}

function ColorDecorator({
  nodeKey,
  token,
}: {
  nodeKey: string;
  token: ColorToken;
}) {
  const { isSelected, isPseudoSelected, select } = useIsSelected(nodeKey);
  const selectClick = React.useRef(false);

  return (
    <span
      className={cl(
        "bg-gray-50 dark:bg-sky-400/20 text-sky-100/90 rounded-sm selection:bg-transparent relative px-2",
        isSelected ? "ring-1 ring-amber-300" : "dark:ring-gray-600",
        isPseudoSelected && caretClasses
      )}
      onMouseDown={() => {
        if (!isSelected) {
          select();
          selectClick.current = true;
        }
      }}
    >
      <span className="flex-center gap-2">
        <SwatchIcon className="w-4 h-4 inline" />
        {token.color}
        <div
          className="w-4 h-4 rounded ring-1 ring-inset ring-white/50"
          style={{ backgroundColor: token.color }}
        />
      </span>
    </span>
  );
}

function convertTokenElement(domNode: HTMLElement): DOMConversionOutput | null {
  return null;
}

export type SerializedTokenNode = Spread<
  {
    type: "token";
    value: Token;
  },
  SerializedLexicalNode
>;

export class TokenNode extends DecoratorNode<React.ReactNode> {
  __value: Token;

  static getType(): string {
    return "token";
  }

  static clone(node: TokenNode): TokenNode {
    return new TokenNode(node.__value, node.__key);
  }

  constructor(token: Token, key?: NodeKey) {
    super(key);
    this.__value = token;
  }

  createDOM(): HTMLElement {
    const element = document.createElement("span");
    element.setAttribute("data-lexical-token", "true");
    return element;
  }

  updateDOM(): false {
    return false;
  }

  getTextContent(): string {
    return "x";
  }

  static importJSON(serializedTokenNode: SerializedTokenNode): TokenNode {
    return $createTokenNode(serializedTokenNode.value);
  }

  exportJSON(): SerializedTokenNode {
    return {
      type: "token",
      value: this.__value,
      version: 1,
    };
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement("span");
    element.setAttribute("data-lexical-token", "true");
    element.textContent = "x";
    return { element };
  }

  static importDOM(): DOMConversionMap | null {
    return {
      span: (domNode: HTMLElement) => {
        if (!domNode.hasAttribute("data-lexical-token")) {
          return null as any;
        }
        return {
          conversion: convertTokenElement,
          priority: 1,
        };
      },
    };
  }

  setToken(token: Token) {
    // getWritable() creates a clone of the node
    // if needed, to ensure we don't try and mutate
    // a stale version of this node.
    const self = this.getWritable();
    self.__value = token;
  }

  getToken(): Token {
    // getLatest() ensures we are getting the most
    // up-to-date value from the EditorState.
    const self = this.getLatest();
    return self.__value;
  }

  decorate(): React.ReactNode {
    return <TokenDecorator nodeKey={this.__key} token={this.__value} />;
  }
}

export function $createTokenNode(token: Token): TokenNode {
  return new TokenNode(token);
}

export function $isTokenNode(node: LexicalNode): node is TokenNode {
  return node instanceof TokenNode;
}
