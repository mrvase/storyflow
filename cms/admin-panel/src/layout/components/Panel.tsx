import React from "react";
import cl from "clsx";
import { ErrorBoundary } from "react-error-boundary";
import useIsFocused from "../../utils/useIsFocused";
import { BranchFocusContext } from "./BranchFocusContext";
import { LocationBar, ToolbarPortalProvider } from "./LocationBar";
import {
  PanelResizeHandle,
  Panel as ResizablePanel,
} from "react-resizable-panels";
import { useSortableItem } from "@storyflow/dnd";
import { getTranslateDragEffect } from "../../utils/dragEffects";
import { LinkReceiver } from "./LinkReceiver";
import { useLocation, useNavigate, useRoute } from "@nanokit/router";
import { NestedTransitionRoutes } from "@nanokit/router/routes/nested-transition";
import { navigateFocusedPanel } from "../../custom-events";
import { ErrorFallback } from "../../elements/ErrorFallback";

function RemoteNavigationEvents({ isFocused }: { isFocused?: boolean }) {
  const navigate = useNavigate();

  React.useEffect(() => {
    if (!isFocused) return;
    return navigateFocusedPanel.subscribe((path) => {
      navigate(path);
    });
  }, [isFocused, navigate]);

  return null;
}

export function Panel() {
  const { pathname } = useLocation();
  const single = pathname.split("/~").length - 1 === 1;

  const { isFocused: _isFocused, handlers, id: focusId } = useIsFocused();
  const isFocused = _isFocused || single;

  const route = useRoute();

  const { dragHandleProps, ref, state } = useSortableItem({
    id: route.accumulated,
    index: route.index,
    item: route,
  });

  const style = getTranslateDragEffect(state);

  return (
    <>
      <RemoteNavigationEvents isFocused={isFocused} />
      {route.index !== 0 && (
        <PanelResizeHandle
          className={cl("group h-full relative", "w-2")}
          style={{
            order: route.index,
          }}
        >
          <LinkReceiver index={route.index} id={`new-${route.accumulated}`} />
        </PanelResizeHandle>
      )}
      <ToolbarPortalProvider>
        <BranchFocusContext.Provider
          value={React.useMemo(
            () => ({ isFocused, id: focusId }),
            [isFocused, focusId]
          )}
        >
          <ResizablePanel
            className="relative h-full py-2"
            id={route.accumulated}
            order={route.index}
            style={{ ...style, order: route.index }}
            minSize={25}
          >
            <LinkReceiver
              id={`existing-${route.accumulated}`}
              type="existing"
              index={route.index}
            />
            <div
              ref={ref}
              {...handlers}
              className={cl(
                "@container w-full h-full flex flex-col rounded-md overflow-hidden border border-gray-150 bg-white dark:bg-gray-900 dark:border-gray-800"
                // "border border-gray-200 dark:border-gray-800"
              )}
            >
              <LocationBar
                isFocused={isFocused}
                dragHandleProps={dragHandleProps}
                matches={route.children}
              />
              <ErrorBoundary FallbackComponent={ErrorFallback}>
                <div className="h-full relative overflow-hidden">
                  <NestedTransitionRoutes />
                </div>
              </ErrorBoundary>
            </div>
          </ResizablePanel>
        </BranchFocusContext.Provider>
      </ToolbarPortalProvider>
    </>
  );
}
