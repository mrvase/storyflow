import React from "react";
import ReactDOM from "react-dom";
import { useSegment } from "../../layout/components/SegmentContext";

const BuilderContext = React.createContext<{
  ref: HTMLDivElement | null;
  isOpen: boolean;
  id: string;
} | null>(null);

export function useBuilder() {
  const ctx = React.useContext(BuilderContext);
  if (!ctx) {
    throw new Error("Could not find a BuilderProvider");
  }
  return ctx;
}

export function BuilderProvider({
  isOpen,
  onLoad,
  children,
}: {
  isOpen: boolean;
  onLoad?: () => void;
  children?: React.ReactNode;
}) {
  const [ref, setRef] = React.useState<HTMLDivElement | null>(null);
  const setRefCallback = React.useCallback((node: HTMLDivElement) => {
    if (node) {
      setRef(node);
    }
  }, []);

  const { full } = useSegment();

  const [type, urlId] = full.split("/").slice(-1)[0].split("-");

  React.useEffect(() => {
    if (type === "c") {
      onLoad?.();
    }
  }, [type]);

  const ctx = React.useMemo(
    () => ({
      ref,
      isOpen,
      id: urlId,
    }),
    [ref, isOpen, full]
  );

  return (
    <>
      <BuilderContext.Provider value={ctx}>
        {children}
        <div ref={setRefCallback} />
      </BuilderContext.Provider>
    </>
  );
}

export function BuilderPortal({
  children,
  id,
}: {
  children: (selected: boolean) => React.ReactElement;
  id: string;
}) {
  const { ref, isOpen, id: urlId } = useBuilder();

  return ref && id === urlId
    ? ReactDOM.createPortal(children(isOpen), ref)
    : null;
}
