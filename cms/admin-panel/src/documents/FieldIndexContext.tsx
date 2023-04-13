import React from "react";

export const TopFieldIndexContext = React.createContext<number | null>(null);

export const useTopFieldIndex = () => {
  return React.useContext(TopFieldIndexContext);
};

export function TopFieldIndexProvider({
  children,
  index,
}: {
  children: React.ReactNode;
  index: number;
}) {
  const value = useTopFieldIndex() ?? index;

  return (
    <TopFieldIndexContext.Provider value={value}>
      {children}
    </TopFieldIndexContext.Provider>
  );
}
