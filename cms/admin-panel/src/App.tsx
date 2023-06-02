import { DragDropContext } from "@storyflow/dnd";
import { Router, useLocation } from "@storyflow/router";
import { SWRConfig } from "swr";
import { AppConfigProvider } from "./AppConfigContext";
import { FieldFocusProvider } from "./FieldFocusContext";
import { IdGenerator } from "./id-generator";
import { DataProvider, Preload } from "./DataProvider";
import { CollabProvider } from "./collab/CollabContext";
import { PanelRouter } from "./layout/panel-router/PanelRouter";
import { Layout } from "./layout/components/Layout";
import { Panels } from "./layout/components/Panels";
import { routes } from "./pages/routes";
import { SignedIn, SignedOut, SignIn } from "./Auth";
import React from "react";
import { useLocalStorage } from "./state/useLocalStorage";
import { Organizations } from "./Organizations";
import { TranslationProvider } from "./translation/TranslationContext";
import { checkToken } from "./clients/auth";

export function App({
  organization,
  lang,
}: {
  organization?: { slug: string; url: string };
  lang?: "da" | "en";
}) {
  const [darkMode] = useLocalStorage<boolean>("dark-mode", true);

  React.useLayoutEffect(() => {
    document.body.classList[darkMode ? "add" : "remove"]("dark");
  }, [darkMode]);

  React.useLayoutEffect(() => {
    checkToken();
  }, []);

  return (
    <div className="w-full h-full bg-gray-100 dark:bg-gray-950 text-gray-800 dark:text-white">
      <TranslationProvider lang={lang}>
        <Router>
          <PanelRouter>
            <SignedIn>
              <FrontPage>
                <Organizations preset={organization} />
              </FrontPage>
              <PanelPage>
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
              </PanelPage>
            </SignedIn>
            <SignedOut>
              <SignIn />
            </SignedOut>
          </PanelRouter>
        </Router>
      </TranslationProvider>
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
