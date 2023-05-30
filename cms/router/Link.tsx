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
    const navigate = useNavigate();
    const location = useLocation();

    const handleClick = React.useCallback(
      (event: React.MouseEvent<HTMLAnchorElement>) => {
        if (onClick) onClick(event);
        if (!event.defaultPrevented && shouldHandleLinkClick(event, target)) {
          event.preventDefault();

          navigate(to, {
            replace: replace ?? createPath(location) === href,
            state,
          });
        }
      },
      [location, navigate, href, replace, target, to, onClick]
    );

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

type LimitedMouseEvent = Pick<
  MouseEvent,
  "button" | "metaKey" | "altKey" | "ctrlKey" | "shiftKey"
>;

function shouldHandleLinkClick(event: LimitedMouseEvent, target?: string) {
  return (
    // Ignore clicks with modifier keys
    !(event.metaKey || event.altKey || event.ctrlKey || event.shiftKey) &&
    // Ignore everything but left clicks
    event.button === 0 &&
    // Let browser handle other target types
    (!target || target === "_self")
  );
}
