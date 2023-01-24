import { DragDropContext } from "@storyflow/dnd";
import { Router } from "@storyflow/router";
import { SWRConfig } from "swr";
import { provider, QueryContextProvider } from "./client";
import { ClientConfigProvider } from "./client-config";
import { FieldFocusProvider } from "./field-focus";
import { FoldersProvider } from "./folders/folders-context";
import { IdGenerator } from "./id-generator";
import { Layout } from "./Layout";
import { Preload } from "./preload";
import { CollabProvider } from "./state/collaboration";

export function App() {
  return (
    <SWRConfig value={{ provider }}>
      <Router>
        <QueryContextProvider>
          <FieldFocusProvider>
            <FoldersProvider>
              <DragDropContext>
                <Preload />
                <CollabProvider>
                  <IdGenerator>
                    <ClientConfigProvider>
                      <Layout />
                    </ClientConfigProvider>
                  </IdGenerator>
                </CollabProvider>
              </DragDropContext>
            </FoldersProvider>
          </FieldFocusProvider>
        </QueryContextProvider>
      </Router>
    </SWRConfig>
  );
}
