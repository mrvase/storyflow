import React from "react";
import {
  DecoratorNode,
  DOMExportOutput,
  LexicalNode,
  NodeKey,
  SerializedLexicalNode,
  Spread,
} from "lexical";
import type { NestedEntity, Token } from "@storyflow/shared/types";
import type { NestedField, Parameter } from "@storyflow/cms/types";
import type { TokenStream, TokenStreamSymbol } from "../../../operations/types";

export type SerializedTokenStreamNode<
  Type extends string,
  Token extends TokenStream[number]
> = Spread<
  {
    type: Type;
    token: Token;
  },
  SerializedLexicalNode
>;

export type ObjectToken =
  | boolean
  | Token
  | NestedEntity
  | NestedField
  | Parameter
  | TokenStreamSymbol;

export class TokenStreamNode<
  Type extends string,
  Token extends ObjectToken
> extends DecoratorNode<React.ReactNode> {
  __type: Type;
  __token: Token;

  constructor(type: Type, token: Token, key?: NodeKey) {
    super(key);
    this.__type = type;
    this.__token = token;
  }

  createDOM(): HTMLElement {
    const element = document.createElement("div");
    element.setAttribute(`data-lexical-${this.__type}`, "true");
    return element;
  }

  updateDOM(): false {
    return false;
  }

  isInline(): boolean {
    return false;
  }

  getTextContent(): string {
    return `#`;
  }

  getTokenStream(): TokenStream {
    return [this.getLatest().__token];
  }

  setToken(token: Token) {
    const self = this.getWritable();
    self.__token = token;
  }

  getToken(): Token {
    const self = this.getLatest();
    return self.__token;
  }

  exportJSON(): SerializedTokenStreamNode<Type, Token> {
    const self = this.getLatest();
    return {
      type: self.__type,
      token: self.__token,
      version: 1,
    };
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement("div");
    element.setAttribute(`data-lexical-${this.__type}`, "true");
    element.textContent = `%`;
    return { element };
  }

  decorate(): React.ReactNode {
    throw new Error("Must be implemented by subclass");
  }
}

export function $isTokenStreamNode(
  node: LexicalNode
): node is TokenStreamNode<string, ObjectToken> {
  return node instanceof TokenStreamNode;
}
