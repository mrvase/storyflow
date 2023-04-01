import React from "react";
import cl from "clsx";
import { getSubSegments } from "../utils";
import FolderPage from "../../folders/FolderPage";
import { useSortableItem } from "@storyflow/dnd";
import { getTranslateDragEffect } from "../../utils/dragEffects";
import { Tab } from "../types";
import { SegmentProvider } from "./SegmentContext";
import { DocumentPage } from "../../documents/DocumentPage";
import useIsFocused from "../../utils/useIsFocused";
import LocationBar from "./LocationBar";
import { ErrorBoundary, FallbackProps } from "react-error-boundary";
import AppPage from "../../folders/AppPage";
import { useLocation, useAction } from "@storyflow/router";
import { SystemFolderPage } from "./SystemFolderPage";
import { SystemTemplatePage } from "./SystemTemplatePage";
import { BranchFocusContext } from "./BranchFocusContext";
import { FieldPage } from "../../fields/FieldPage";
import { IframeProvider } from "../../fields/builder/IframeContext";

const useFocusChange = (
  isFocused: boolean,
  onLostFocus: (isFocused: boolean) => void
) => {
  const prev = React.useRef(isFocused);
  React.useEffect(() => {
    // this basically prevents it from running on initialization
    if (prev.current !== isFocused) {
      onLostFocus(isFocused);
    }
    prev.current = isFocused;
  }, [isFocused, onLostFocus]);
};

function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  const [showMessage, toggleMessage] = React.useReducer((ps) => !ps, false);
  return (
    <div className="p-5 bg-white dark:bg-gray-850 text-center h-full text-gray-700 dark:text-white font-light">
      Der skete en fejl 💥
      <br />
      <br />
      <button
        onClick={() => {
          resetErrorBoundary();
        }}
        className="py-2 px-3 rounded bg-teal-600 mx-auto hover:bg-teal-700"
      >
        Prøv igen.
      </button>
      <br />
      <br />
      <div className="text-red-300 text-sm">
        <button
          onClick={() => {
            toggleMessage();
            console.error(error);
          }}
        >
          {showMessage ? "Skjul" : "Vis"} fejlmeddelelse
        </button>
        {showMessage && (
          <>
            <br />
            {error.message}
          </>
        )}
      </div>
    </div>
  );
}

function useEffectOnLocationNoop(func: () => void) {
  let action = useAction();
  let locationObj = useLocation();

  const { pathname } = locationObj;

  const oldPathname = React.useRef(pathname);
  React.useEffect(() => {
    if (action === "PUSH") {
      if (oldPathname.current === pathname) {
        func();
      }
      oldPathname.current = pathname;
    }
  }, [locationObj, action]);

  return null;
}

export default function Branch({
  tab,
  numberOfVisibleTabs,
  width,
  pinned,
  togglePin,
  children,
}: {
  tab: Tab;
  numberOfVisibleTabs: number;
  width: string;
  pinned: boolean;
  togglePin: () => void;
  children?: React.ReactNode;
}) {
  const segments = getSubSegments(tab.segment);

  const { isFocused: _isFocused, handlers, id: focusId } = useIsFocused();

  const isFocused = _isFocused || pinned || numberOfVisibleTabs === 1;

  const top = tab.segment;

  const [_selected, setSelected] = React.useState<string | null>(null);
  const selected = _selected ?? top;

  const select = (segment: string) => {
    if (segment === top) {
      setSelected(top);
    }
  };

  useFocusChange(
    isFocused,
    React.useCallback(
      (isFocused) => {
        if (!isFocused) setSelected(top);
      },
      [top]
    )
  );

  const prevTop = React.useRef("");

  React.useEffect(() => {
    if (prevTop.current.startsWith(top)) {
      // ALREADY LOADED - READY TO SET TOP
      setSelected(top);
    }
    prevTop.current = top;
  }, [top]);

  const { dragHandleProps, ref, state } = useSortableItem({
    index: tab.order,
    item: tab,
  });

  useEffectOnLocationNoop(() => setSelected(null));

  const style = getTranslateDragEffect(state);

  return (
    <>
      <BranchFocusContext.Provider
        value={React.useMemo(
          () => ({ isFocused, id: focusId }),
          [isFocused, focusId]
        )}
      >
        <div
          ref={ref}
          className={cl(
            "shrink-0 grow-0 snap-start px-1 pt-2 pb-2",
            pinned && "sticky left-0 right-0 z-10"
          )}
          style={{ order: tab.order, width, ...style }}
          {...handlers}
        >
          <div
            className={cl(
              "w-full grow-0 h-full flex flex-col rounded-md overflow-hidden border border-gray-200 dark:border-gray-800",
              pinned && "shadow-lg shadow-black/50"
              // isFocused && "ring-4 ring-amber-100"
            )}
          >
            <LocationBar
              tab={tab}
              isFocused={isFocused}
              dragHandleProps={dragHandleProps}
              selected={selected}
              setSelected={setSelected}
              segments={segments}
              pinned={pinned}
              togglePin={togglePin}
            />
            <ErrorBoundary FallbackComponent={ErrorFallback} resetKeys={[top]}>
              <div className="h-[calc(100vh-92px)] relative overflow-hidden">
                <Pages
                  tab={tab}
                  numberOfVisibleTabs={numberOfVisibleTabs}
                  segments={segments}
                  selected={selected}
                  select={select}
                />
              </div>
            </ErrorBoundary>
          </div>
        </div>
      </BranchFocusContext.Provider>
      {children}
    </>
  );
}

function Pages({
  segments,
  numberOfVisibleTabs,
  tab,
  selected,
  select,
}: {
  tab: Tab;
  numberOfVisibleTabs: number;
  segments: string[];
  selected: string;
  select: (s: string) => void;
}) {
  const selectedLength = selected.split("/").length;

  if (segments.some((x) => x.endsWith("folders"))) {
    return <SystemFolderPage />;
  }

  if (segments.some((x) => x.endsWith("templates"))) {
    return <SystemTemplatePage />;
  }

  return (
    <>
      {segments
        .slice()
        .reverse()
        .reduce((children, segment) => {
          const [type] = segment.split("/").slice(-1)[0].split("-");
          if (type.startsWith("~") /** root */ || type === "f") {
            return (
              <SegmentProvider
                key={segment}
                current={segment}
                full={tab.segment}
              >
                <FolderPage
                  isOpen={selectedLength >= segment.split("/").length}
                  isSelected={selected === segment}
                  onLoad={() => select(segment)}
                  numberOfVisibleTabs={numberOfVisibleTabs}
                >
                  {children}
                </FolderPage>
              </SegmentProvider>
            );
          } else if (type === "a") {
            return (
              <SegmentProvider
                key={segment}
                current={segment}
                full={tab.segment}
              >
                <AppPage
                  isOpen={selectedLength >= segment.split("/").length}
                  isSelected={selected === segment}
                  onLoad={() => select(segment)}
                  numberOfVisibleTabs={numberOfVisibleTabs}
                >
                  {children}
                </AppPage>
              </SegmentProvider>
            );
          } else if (type === "d" || type === "t") {
            return (
              <SegmentProvider
                key={segment}
                current={segment}
                full={tab.segment}
              >
                <DocumentPage
                  isOpen={selectedLength >= segment.split("/").length}
                  isSelected={selected === segment}
                  onLoad={() => select(segment)}
                >
                  {children}
                </DocumentPage>
              </SegmentProvider>
            );
          } else if (type === "c") {
            return (
              <SegmentProvider
                key={segment}
                current={segment}
                full={tab.segment}
              >
                <IframeProvider>
                  <FieldPage
                    isOpen={selectedLength >= segment.split("/").length}
                    isSelected={selected === segment}
                    onLoad={() => select(segment)}
                  >
                    {children}
                  </FieldPage>
                </IframeProvider>
              </SegmentProvider>
            );
          }
          return null;
        }, null as React.ReactNode)}
    </>
  );
}
