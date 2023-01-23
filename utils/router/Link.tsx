import React from "react";
import { useHref, useNavigate, useResolvedPath } from "./hooks";
import { useLocation, useNavigator } from "./Router";
import { NavigateOptions, Path, To } from "./types";
import { createPath, resolveTo } from "./utils";

export interface LinkProps
  extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  reload?: boolean;
  state?: any;
  replace?: boolean;
  scroll?: boolean;
  to: To;
}

export const Link = React.forwardRef<HTMLAnchorElement, LinkProps>(
  (
    { onClick, reload, replace, target, to, state, scroll = true, ...rest },
    ref
  ) => {
    let href = useHref(to);
    let internalOnClick = useLinkClickHandler(to, {
      replace,
      target,
      state,
      scroll,
    });
    function handleClick(
      event: React.MouseEvent<HTMLAnchorElement, MouseEvent>
    ) {
      if (onClick) onClick(event);
      if (!event.defaultPrevented) {
        internalOnClick(event);
      }
    }

    return (
      <a
        {...rest}
        href={href}
        onClick={reload ? onClick : handleClick}
        ref={ref}
        target={target}
      />
    );
  }
);

export function useLinkClickHandler<E extends Element = HTMLAnchorElement>(
  to: To,
  {
    target,
    replace: replaceProp,
    state,
    scroll,
  }: {
    target?: React.HTMLAttributeAnchorTarget;
    replace?: boolean;
    state?: any;
    scroll?: boolean;
  } = {}
): (event: React.MouseEvent<E, MouseEvent>) => void {
  let navigate = useNavigate();
  let location = useLocation();
  let path = useResolvedPath(to);

  return React.useCallback(
    (event: React.MouseEvent<E, MouseEvent>) => {
      if (shouldProcessLinkClick(event, target)) {
        event.preventDefault();

        // If the URL hasn't changed, a regular <a> will do a replace instead of
        // a push, so do the same here unless the replace prop is explicitly set
        let replace =
          replaceProp !== undefined
            ? replaceProp
            : createPath(location) === createPath(path);

        navigate(to, { replace, scroll, state });
      }
    },
    [location, navigate, path, replaceProp, target, to, scroll]
  );
}

type LimitedMouseEvent = Pick<
  MouseEvent,
  "button" | "metaKey" | "altKey" | "ctrlKey" | "shiftKey"
>;

function isModifiedEvent(event: LimitedMouseEvent) {
  return !!(event.metaKey || event.altKey || event.ctrlKey || event.shiftKey);
}

function shouldProcessLinkClick(event: LimitedMouseEvent, target?: string) {
  return (
    event.button === 0 && // Ignore everything but left clicks
    (!target || target === "_self") && // Let browser handle "target=_blank" etc.
    !isModifiedEvent(event) // Ignore clicks with modifier keys
  );
}
