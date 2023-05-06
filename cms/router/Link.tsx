import React from "react";
import { useNavigate } from "./Router";
import { useLocation } from "./Router";
import type { To } from "./types";
import { createPath, resolveTo } from "./utils";

export interface LinkProps
  extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  reload?: boolean;
  state?: any;
  replace?: boolean;
  scroll?: boolean;
  to: To;
}

export function useHref(to: To): string {
  let { pathname } = useLocation();
  return React.useMemo(
    () => createPath(resolveTo(to, pathname)),
    [to, pathname]
  );
}

export const Link = React.forwardRef<HTMLAnchorElement, LinkProps>(
  (
    { onClick, reload, replace, target, to, state, scroll = true, ...rest },
    ref
  ) => {
    const href = useHref(to);
    const internalOnClick = useLinkClickHandler(to, {
      replace,
      target,
      state,
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
  }: {
    target?: React.HTMLAttributeAnchorTarget;
    replace?: boolean;
    state?: any;
  } = {}
): (event: React.MouseEvent<E, MouseEvent>) => void {
  const navigate = useNavigate();
  const location = useLocation();
  const href = useHref(to);

  return React.useCallback(
    (event: React.MouseEvent<E, MouseEvent>) => {
      if (shouldProcessLinkClick(event, target)) {
        event.preventDefault();

        let replace = replaceProp ?? createPath(location) === href;

        navigate(to, { replace, state });
      }
    },
    [location, navigate, href, replaceProp, target, to]
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
