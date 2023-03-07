import React from "react";

type SegmentContextType = { current: string; full: string };

const SegmentContext = React.createContext<SegmentContextType | null>(null);

export function SegmentProvider({
  children,
  current,
  full,
}: {
  children: React.ReactNode;
  current: string;
  full: string;
}) {
  return (
    <SegmentContext.Provider
      value={React.useMemo(() => ({ current, full }), [current, full])}
    >
      {children}
    </SegmentContext.Provider>
  );
}

export const useSegment = () => {
  const ctx = React.useContext(SegmentContext);
  if (!ctx) {
    throw new Error("useSegment must be used within the SegmentProvider");
  }
  return ctx;
};

export const useUnsafeSegment = () => {
  return React.useContext(SegmentContext);
};
