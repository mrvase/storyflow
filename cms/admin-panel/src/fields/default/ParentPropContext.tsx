import React from "react";

const ParentPropContext = React.createContext<string | null>(null);

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

export const useParentProp = () => React.useContext(ParentPropContext);
