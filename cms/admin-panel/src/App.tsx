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
                  <ClientConfigProvider>
                    <IdGenerator>
                      <Layout />
                    </IdGenerator>
                  </ClientConfigProvider>
                </CollabProvider>
              </DragDropContext>
            </FoldersProvider>
          </FieldFocusProvider>
        </QueryContextProvider>
      </Router>
    </SWRConfig>
  );
}
