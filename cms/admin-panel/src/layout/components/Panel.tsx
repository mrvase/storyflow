import React from "react";
import cl from "clsx";
import { ErrorBoundary, FallbackProps } from "react-error-boundary";
import { PanelData } from "../../panel-router/types";
import useIsFocused from "../../utils/useIsFocused";
import { BranchFocusContext } from "./BranchFocusContext";
import { LocationBar } from "./LocationBar";
import { Panel as ResizablePanel } from "react-resizable-panels";
import { useSortableItem } from "@storyflow/dnd";
import { getTranslateDragEffect } from "../../utils/dragEffects";
import { LinkReceiver } from "./LinkReceiver";
import { fetchDocument } from "../../documents";
import { useClient } from "../../client";
import { getDocumentLabel } from "../../documents/useDocumentLabel";
import { Link, useLocation } from "@storyflow/router";
import { replacePanelPath } from "../../panel-router/utils";

function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  const [showMessage, toggleMessage] = React.useReducer((ps) => !ps, false);
  return (
    <div className="p-5 bg-white dark:bg-gray-850 text-center h-full text-gray-700 dark:text-white">
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

export function Panel({
  data,
  single,
  children,
}: {
  data: PanelData;
  single: boolean;
  children: React.ReactNode;
}) {
  const { isFocused: _isFocused, handlers, id: focusId } = useIsFocused();
  const isFocused = _isFocused || single;

  const { dragHandleProps, ref, state } = useSortableItem({
    id: data.key,
    index: data.index,
    item: data,
  });

  const style = getTranslateDragEffect(state);

  return (
    <BranchFocusContext.Provider
      value={React.useMemo(
        () => ({ isFocused, id: focusId }),
        [isFocused, focusId]
      )}
    >
      <ResizablePanel
        className="relative h-full py-2"
        id={data.key}
        order={data.index}
        style={{ ...style, order: data.index }}
        minSize={25}
      >
        <LinkReceiver
          id={`existing-${data.key}`}
          type="existing"
          index={data.index}
        />
        <div
          ref={ref}
          {...handlers}
          className={cl(
            "@container w-full h-full flex flex-col rounded-md overflow-hidden border border-gray-200 dark:border-gray-800"
          )}
        >
          <LocationBar
            data={data}
            isFocused={isFocused}
            dragHandleProps={dragHandleProps}
          />
          <ErrorBoundary FallbackComponent={ErrorFallback}>
            <div className="h-[calc(100vh-48px)] relative overflow-hidden bg-white dark:bg-gray-850">
              {children}
            </div>
          </ErrorBoundary>
          <VisitedLinks data={data} />
        </div>
      </ResizablePanel>
    </BranchFocusContext.Provider>
  );
}

function VisitedLinks({ data: { path, index } }: { data: PanelData }) {
  const [visited, setVisited] = React.useState<
    { path: string; label: string; type: "t" | "d" }[]
  >([]);

  const client = useClient();

  const prev = React.useRef<string | null>(null);

  React.useEffect(() => {
    const prevPath = prev.current;
    prev.current = path;
    if (!prevPath || prevPath === path) return;
    const last = prevPath.split("/").slice(-1)[0];
    const type = last.slice(0, 1);
    const id = last.slice(1).padStart(24, "0");
    let mounted = true;
    if (type === "d" || type === "t") {
      fetchDocument(id, client).then((doc) => {
        if (!mounted) return;
        const label = doc?.label ?? getDocumentLabel(doc);
        if (!label) return;
        setVisited((ps) =>
          [
            { path: prevPath, label, type: type as "d" | "t" },
            ...ps.filter((el) => el.path !== prevPath),
          ].slice(0, 5)
        );
      });
    }
    return () => {
      mounted = false;
    };
  }, [path]);

  console.log("PATH", path, visited);

  const { pathname } = useLocation();
  const getHref = (path: string) =>
    replacePanelPath(pathname, { path, index: 0 });

  return (
    <div className="h-7 bg-gray-850 text-xs px-2 flex gap-3">
      {visited.map((el) => (
        <Link
          to={getHref(el.path)}
          key={el.path}
          className={cl(
            "h-7 flex items-center transition-colors",
            el.type === "t"
              ? "text-teal-700 hover:text-teal-400"
              : "text-gray-600 hover:text-gray-200"
          )}
        >
          {el.label}
        </Link>
      ))}
    </div>
  );
}
