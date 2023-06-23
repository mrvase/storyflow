import {
  $getRoot,
  $setSelection,
  ElementNode,
  LexicalEditor,
  LexicalNode,
  NodeKey,
} from "lexical";
import $createRangeSelection from "../../../editor/createRangeSelection";
import { FunctionName } from "@storyflow/shared/types";
import { SIGNATURES } from "@storyflow/cms/constants";
import { FunctionSymbol } from "@storyflow/cms/types";
import { getFunctionName } from "@storyflow/cms/symbols";

export default class BlockNode extends ElementNode {
  __func: FunctionSymbol;

  constructor(func: FunctionSymbol, key?: NodeKey) {
    super(key);
    this.__func = func;
  }

  static getType(): string {
    return "block";
  }

  static clone(node: BlockNode): BlockNode {
    return new BlockNode(node.__func, node.__key);
  }

  createDOM(): HTMLElement {
    // Define the DOM element here
    const el = document.createElement("div");
    const name = getFunctionName(this.__func);
    const signature = name in SIGNATURES ? SIGNATURES[name] : [name];

    signature.forEach((param, index) => {
      el.style.setProperty(`--p${index + 1}`, `" ${param}"`);
    });

    el.classList.add("block-node");
    return el;
  }

  updateDOM(prevNode: BlockNode, dom: HTMLElement): boolean {
    // Returning false tells Lexical that this node does not need its
    // DOM element replacing with a new copy from createDOM.
    return false;
  }

  isIsolated(): boolean {
    return false;
  }

  isKeyboardSelectable(): boolean {
    return true;
  }

  canBeEmpty(): boolean {
    return false;
  }
}

export function $createBlockNode(func: FunctionSymbol): BlockNode {
  return new BlockNode(func);
}

export function $isBlockNode(
  node: LexicalNode | null | undefined
): node is BlockNode {
  return node instanceof BlockNode;
}
