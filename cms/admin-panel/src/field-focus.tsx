import React from "react";

const FieldFocusContext = React.createContext<
  [string | null, (value: string | null) => void] | null
>(null);

export function FieldFocusProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const state = React.useState<string | null>(null);
  return (
    <FieldFocusContext.Provider value={state}>
      {children}
    </FieldFocusContext.Provider>
  );
}

export const useFieldFocus = () => {
  const ctx = React.useContext(FieldFocusContext);
  if (ctx === null) {
    throw new Error("useFieldFocus must be used within the FieldFocusProvider");
  }
  return ctx;
};
