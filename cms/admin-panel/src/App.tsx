import { DragDropContext } from "@storyflow/dnd";
import { Router, useLocation } from "@storyflow/router";
import { SWRConfig } from "swr";
import { provider, RPCProvider } from "./RPCProvider";
import { AppConfigProvider } from "./AppConfigContext";
import { FieldFocusProvider } from "./FieldFocusContext";
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

export function App({
  organization,
}: {
  organization?: { slug: string; url: string };
}) {
  const [darkMode] = useLocalStorage<boolean>("dark-mode", true);

  React.useLayoutEffect(() => {
    document.body.classList[darkMode ? "add" : "remove"]("dark");
  }, [darkMode]);

  return (
    <div className="w-full h-full bg-gray-100 dark:bg-gray-950 text-gray-800 dark:text-white">
      <SWRConfig value={{ provider }}>
        <Router>
          <PanelRouter>
            <AuthProvider organization={organization}>
              <SignedIn>
                <FrontPage>
                  <Organizations preset={organization} />
                </FrontPage>
                <PanelPage>
                  <RPCProvider>
                    <Preload />
                    <CollabProvider>
                      <DataProvider>
                        <AppConfigProvider>
                          <IdGenerator>
                            <FieldFocusProvider>
                              <DragDropContext>
                                <Layout>
                                  <Panels routes={routes} />
                                </Layout>
                              </DragDropContext>
                            </FieldFocusProvider>
                          </IdGenerator>
                        </AppConfigProvider>
                      </DataProvider>
                    </CollabProvider>
                  </RPCProvider>
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

  return pathname === "/" || pathname === "logout" ? <>{children}</> : null;
}

function PanelPage({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();

  return pathname === "/" || pathname === "logout" ? null : <>{children}</>;
}
