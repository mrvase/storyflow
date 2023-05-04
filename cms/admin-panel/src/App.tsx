import { DragDropContext } from "@storyflow/dnd";
import { Router, useLocation } from "@storyflow/router";
import { SWRConfig } from "swr";
import { provider, QueryContextProvider } from "./client";
import { ClientConfigProvider } from "./client-config";
import { FieldFocusProvider } from "./field-focus";
import { IdGenerator } from "./id-generator";
import { DataProvider, Preload } from "./DataProvider";
import { CollabProvider } from "./collab/CollabContext";
import { PanelRouter } from "./layout/panel-router/PanelRouter";
import { Layout } from "./layout/components/Layout";
import { Panels } from "./layout/components/Panels";
import { routes } from "./pages/routes";
import { AuthProvider, SignedIn, SignedOut, SignIn } from "./Auth";
import React from "react";
import { useLocalStorage } from "./state/useLocalStorage";
import { Organizations } from "./Organizations";

export function App() {
  const [darkMode] = useLocalStorage<boolean>("dark-mode", true);

  React.useLayoutEffect(() => {
    document.body.classList[darkMode ? "add" : "remove"]("dark");
  }, [darkMode]);

  return (
    <div className="w-full h-full bg-gray-100 dark:bg-gray-950 text-gray-800 dark:text-white">
      <SWRConfig value={{ provider }}>
        <Router>
          <PanelRouter>
            <AuthProvider>
              <SignedIn>
                <FrontPage>
                  <Organizations />
                </FrontPage>
                <PanelPage>
                  <QueryContextProvider>
                    <Preload />
                    <CollabProvider>
                      <DataProvider>
                        <FieldFocusProvider>
                          <DragDropContext>
                            <ClientConfigProvider>
                              <IdGenerator>
                                <Layout>
                                  <Panels routes={routes} />
                                </Layout>
                              </IdGenerator>
                            </ClientConfigProvider>
                          </DragDropContext>
                        </FieldFocusProvider>
                      </DataProvider>
                    </CollabProvider>
                  </QueryContextProvider>
                </PanelPage>
              </SignedIn>
              <SignedOut>
                <SignIn />
              </SignedOut>
            </AuthProvider>
          </PanelRouter>
        </Router>
      </SWRConfig>
    </div>
  );
}

function FrontPage({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();

  return pathname === "/" ? <>{children}</> : null;
}

function PanelPage({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();

  return pathname === "/" ? null : <>{children}</>;
}
