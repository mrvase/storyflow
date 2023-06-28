"use client";

import { NestedDocumentId } from "@storyflow/shared/types";
import React from "react";

export const IdContext = React.createContext<string | undefined>(undefined);

export const IdContextProvider = ({
  children,
  id,
}: {
  children: React.ReactNode;
  id: NestedDocumentId;
}) => {
  return <IdContext.Provider value={id}>{children}</IdContext.Provider>;
};
