import React from "react";

export const useContextWithError = <T>(
  context: React.Context<T>,
  name: string
) => {
  const ctx = React.useContext(context);
  if (ctx === null) throw new Error(`Cannot find ${name}Context.Provider`);
  return ctx;
};
