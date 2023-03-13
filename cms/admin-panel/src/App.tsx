import { DragDropContext } from "@storyflow/dnd";
import { Router } from "@storyflow/router";
import { SWRConfig } from "swr";
import { provider, QueryContextProvider } from "./client";
import { ClientConfigProvider } from "./client-config";
import { FieldFocusProvider } from "./field-focus";
import { FoldersProvider } from "./folders/folders-context";
import { IdGenerator } from "./id-generator";
import Layout from "./layout/components/Layout";
import { Preload } from "./preload";
import { DocumentCollabProvider } from "./documents/collab/DocumentCollabContext";
import { FolderCollabProvider } from "./folders/collab/FolderCollabContext";

export function App() {
  return (
    <SWRConfig value={{ provider }}>
      <Router>
        <QueryContextProvider>
          <Preload />
          <FoldersProvider>
            <FieldFocusProvider>
              <DragDropContext>
                <FolderCollabProvider>
                  <DocumentCollabProvider>
                    <ClientConfigProvider>
                      <IdGenerator>
                        <Layout />
                      </IdGenerator>
                    </ClientConfigProvider>
                  </DocumentCollabProvider>
                </FolderCollabProvider>
              </DragDropContext>
            </FieldFocusProvider>
          </FoldersProvider>
        </QueryContextProvider>
      </Router>
    </SWRConfig>
  );
}
