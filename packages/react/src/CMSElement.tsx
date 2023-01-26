import React from "react";
import { useRenderContext } from "./RenderContext";

type RegularProps<Type extends keyof JSX.IntrinsicElements> =
  React.PropsWithoutRef<React.ComponentProps<Type>> & React.RefAttributes<any>;

type Component<Props> = React.ForwardRefExoticComponent<
  Props extends { as: infer T }
    ? T extends keyof JSX.IntrinsicElements
      ? { as: T } & RegularProps<T>
      : never
    : Props
>;

type CMSComponentType = {
  [K in keyof JSX.IntrinsicElements]: Component<RegularProps<K>>;
} & {
  element: Component<{ as: keyof JSX.IntrinsicElements }>;
};

const useRenderContextServer =
  typeof window === "undefined" ? undefined : useRenderContext;

/* Can be used for e.g. the Next.js Link component, if it is the parent element of the component */
export const CMSElement = ({ children }: { children: React.ReactElement }) => {
  const props = useRenderContextServer?.()?.(children.props);
  return React.cloneElement(children, props);
};

export const cms = new Proxy({} as CMSComponentType, {
  get(target, prop: string) {
    if (!(prop in target)) {
      target[prop as "div"] = React.forwardRef<any, React.ComponentProps<any>>(
        (props, ref) => {
          const { as, ...rest } = useRenderContextServer?.()?.(props) ?? props;
          const Tag = prop === "element" ? as : prop;
          return <Tag ref={ref} {...rest} />;
        }
      );
    }
    return target[prop as "div"];
  },
});

/*
const initial: CMSComponentType = {} as CMSComponentType;

function CMSElement({
  tag: Component,
  refProp,
  ...props
}: { tag: "div"; refProp: any } & React.ComponentProps<"div">) {
  props = useRenderContext()?.(props) ?? props;
  return <Component ref={refProp} {...props} />;
}

const produceElement = <K extends keyof JSX.IntrinsicElements>(tag: string) => {
  const ElementWrapper = React.forwardRef<any, React.ComponentProps<K>>(
    (props, ref) => {
      // const { Element } = useRender();
      return (
        <CMSElement
          tag={tag as "div"}
          refProp={ref}
          {...(props as React.ComponentProps<"div">)}
        />
      );
    }
  );
  return ElementWrapper;
};

export const cms = new Proxy(initial, {
  get(target, property) {
    if (typeof property !== "string") {
      return () => null;
    }
    if (!(property in target)) {
      target[property as "div"] = produceElement<"div">(property);
    }
    return target[property as "div"];
  },
});
*/
