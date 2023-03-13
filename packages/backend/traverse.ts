import { Computation, FieldId, NestedDocument } from "./types";
import { symb } from "./symb";
import { extendPath } from "./extendPath";
import { getDocumentId, getRawFieldId } from "./ids";

export const getChild = (value: Computation, key: string) => {
  if (key.indexOf("/") >= 0) {
    // argument
    const [id, property] = key.split("/");

    const element = value.find(
      (el): el is LayoutElement | FieldImport =>
        typeof el === "object" && "id" in el && el.id === id
    )!;

    if (symb.isLayoutElement(element)) {
      return element.props[property];
    } else {
      return element.args[parseInt(property, 10)];
    }
  } else {
    // nested document
    const fieldId = key as FieldId;
    const id = getDocumentId(fieldId);
    const templateFieldId = getRawFieldId(fieldId);

    const element = value.find(
      (el): el is NestedDocument => symb.isNestedDocument(el) && el.id === id
    )!;

    return element.values[templateFieldId];
  }
};

export const getChildren = (
  value: Computation,
  config?: { components: Record<string, { props: { type: string }[] }> }
) => {
  const searchable = (element: LayoutElement, key: string) => {
    const component = config?.components?.[element.type];
    if (!component) return `${element.id}/${key}`;
    const prop = component.props.find((el) => el.type === key);
    const hasMarker = prop?.type === "children" || (prop as any)?.searchable;
    return `${element.id}/${key}${hasMarker ? "#" : ""}`;
  };
  const keys = value.reduce((acc: string[], element) => {
    if (symb.isLayoutElement(element)) {
      return acc.concat(
        Object.keys(element.props).map((key) => searchable(element, key))
      );
    } else if (symb.isNestedDocument(element)) {
      return acc.concat(
        Object.keys(element.values).map((key) => `${element.id}${key}`)
      );
    } else if (symb.isFieldImport(element)) {
      return acc.concat(
        Object.keys(element.args).map((key) => `${element.id}/${key}`)
      );
    }
    return acc;
  }, [] as string[]);

  return Object.fromEntries(
    keys
      .map(
        (key) =>
          [key, getChild(value, key)] as [string, Computation | undefined]
      )
      .filter((el): el is [string, Computation] => typeof el[1] !== "undefined")
  );
};

export const modifyChild = (
  value: Computation,
  key: string,
  callback: (value: Computation) => Computation
): Computation | undefined => {
  if (key === "") {
    // root
    throw new Error("Root is not modified through modifyChild");
  }

  if (key.indexOf("/") < 0) {
    // root
    return callback(value);
  } else {
    const [id, propKey] = key.split("/");

    const newComputation = [...value];
    const index = value.findIndex(
      (el) => typeof el === "object" && "id" in el && el.id === id
    );
    if (index < 0) return undefined;
    const element = newComputation[index] as LayoutElement | FieldImport;
    if (symb.isLayoutElement(element)) {
      const prop = element.props[propKey] ?? [];
      (newComputation[index] as LayoutElement) = {
        ...element,
        props: {
          ...element.props,
          [propKey]: callback(prop),
        },
      };
    } else {
      const p = parseInt(propKey, 10);
      const prop = element.args[p] ?? [];
      (newComputation[index] as FieldImport) = {
        ...element,
        args: {
          ...element.args,
          [p]: callback(prop),
        },
      };
    }

    return newComputation;
  }
};

export const traverse = <T extends Computation>(
  value: T,
  callback: (value: T, path: string) => void,
  config?: { components: Record<string, { props: { type: string }[] }> },
  path = ""
) => {
  callback(value, path);
  const children = getChildren(value);
  Object.entries(children).forEach(([key, child]) => {
    if (child !== null) {
      traverse(child as T, callback, config, extendPath(path, key));
    }
  });
};

export const getNestedChild = (
  value: Computation,
  key: string[]
): Computation | undefined => {
  try {
    const nextChild = getChild(value, key[0]);
    if (!nextChild) return;
    if (key.length === 1) {
      return nextChild;
    }
    return getNestedChild(nextChild, key.slice(1) as string[]);
  } catch {
    return undefined;
  }
};

export const modifyNestedChild = (
  value: Computation,
  keys: string[],
  callback: (value: Computation) => Computation
): Computation | undefined => {
  const nextCallback = (index: number) => {
    return (child: Computation): Computation => {
      if (index === keys.length) {
        return callback(child);
      }
      const result = modifyChild(child, keys[index], nextCallback(index + 1));
      if (!result) {
        throw "undefined";
      }
      return result;
    };
  };

  try {
    return nextCallback(0)(value);
  } catch (err) {
    return undefined;
  }
};
