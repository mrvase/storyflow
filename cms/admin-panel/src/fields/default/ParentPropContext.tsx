import React from "react";

export const ParentPropContext = React.createContext<string | null>(null);

export const ParentProp = ({
  children,
  name,
}: {
  children: React.ReactNode;
  name: string;
}) => (
  <ParentPropContext.Provider value={name}>
    {children}
  </ParentPropContext.Provider>
);
