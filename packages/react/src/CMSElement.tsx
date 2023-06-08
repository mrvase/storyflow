import * as React from "react";
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
          const builderCtx = useRenderContextServer?.();
          const { as, children, contentEditable, ...rest } =
            builderCtx?.(props) ?? props;
          const Tag = prop === "element" ? as : prop;
          if (contentEditable) {
            return (
              <Tag
                key="editable"
                contentEditable={true}
                ref={rest.ref}
                {...rest}
              />
            );
          }
          return (
            <Tag
              key={builderCtx ? "ineditable" : undefined}
              ref={ref}
              {...rest}
              children={children}
            />
          );
        }
      );
    }
    return target[prop as "div"];
  },
});
