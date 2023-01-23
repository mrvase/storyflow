export function isNode(node: Object): node is Node {
  return "nodeType" in node;
}

export function isWindow(element: Object): element is typeof window {
  return Object.prototype.toString.call(element) === "[object Window]";
}

export function getWindow(target: Event["target"]): typeof window {
  if (!target) {
    return window;
  }

  if (isWindow(target)) {
    return target;
  }

  if (!isNode(target)) {
    return window;
  }

  return target.ownerDocument?.defaultView ?? window;
}

export function getFrame(target: Event["target"]): Element | null {
  return getWindow(target).frameElement;
}

export function isDocument(node: Node): node is Document {
  const { Document } = getWindow(node);

  return node instanceof Document;
}

export function isHTMLElement(node: Node | Window): node is HTMLElement {
  if (isWindow(node)) {
    return false;
  }

  return node instanceof getWindow(node).HTMLElement;
}

export function isSVGElement(node: Node): node is SVGElement {
  return node instanceof getWindow(node).SVGElement;
}

export function getOwnerDocument(target: Event["target"]): Document {
  if (!target) {
    return document;
  }

  if (isWindow(target)) {
    return target.document;
  }

  if (!isNode(target)) {
    return document;
  }

  if (isDocument(target)) {
    return target;
  }

  if (isHTMLElement(target)) {
    return target.ownerDocument;
  }

  return document;
}
