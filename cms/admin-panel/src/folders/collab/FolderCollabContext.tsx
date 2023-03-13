import React from "react";
import { useContextWithError } from "../../utils/contextError";
import { useClient } from "../../client";
import { createDocumentCollaboration } from "../../state/collaboration";

export const FolderCollabContext = React.createContext<ReturnType<
  typeof createDocumentCollaboration
> | null>(null);

export const useFolderCollab = () =>
  useContextWithError(FolderCollabContext, "Collab");
/*
rokere spaces: document: "folders", key: "folder-id", location: ""
indenfor space: "folders", key: "folder-id", location: "space-id"
*/

export function FolderCollabProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const client = useClient();

  const collab = React.useMemo(() => {
    return createDocumentCollaboration(client.folders.sync.mutation, {
      duration: 20000,
    });
  }, [client]);

  React.useLayoutEffect(() => {
    return collab.syncOnInterval();
  }, []);

  return (
    <FolderCollabContext.Provider value={collab}>
      {children}
    </FolderCollabContext.Provider>
  );
}
