import { DragDropContext } from "@storyflow/dnd";
import { Router } from "@storyflow/router";
import { SWRConfig } from "swr";
import { provider, QueryContextProvider } from "./client";
import { ClientConfigProvider } from "./client-config";
import { FieldFocusProvider } from "./field-focus";
import { FoldersProvider } from "./folders/FoldersContext";
import { IdGenerator } from "./id-generator";
import { Preload } from "./preload";
import { CollabProvider } from "./collab/CollabContext";
import { PanelRouter } from "./panel-router/PanelRouter";
import { Layout } from "./layout/components/Layout";

export function App() {
  return (
    <SWRConfig value={{ provider }}>
      <Router>
        <PanelRouter>
          <QueryContextProvider>
            <Preload />
            <CollabProvider>
              <FoldersProvider>
                <FieldFocusProvider>
                  <DragDropContext>
                    <ClientConfigProvider>
                      <IdGenerator>
                        <Layout />
                      </IdGenerator>
                    </ClientConfigProvider>
                  </DragDropContext>
                </FieldFocusProvider>
              </FoldersProvider>
            </CollabProvider>
          </QueryContextProvider>
        </PanelRouter>
      </Router>
    </SWRConfig>
  );
}
