import { DragDropContext } from "@storyflow/dnd";
import {
  Router,
  createHistory,
  useLocation,
  useRouterIsLoading,
} from "@nanokit/router";
import { AppConfigProvider } from "./AppConfigContext";
import { FieldFocusProvider } from "./FieldFocusContext";
import { IdGenerator } from "./id-generator";
import { Preload } from "./DataProvider";
import { routes } from "./pages/routes";
import { SignedIn, SignedOut, SignIn } from "./Auth";
import React from "react";
import { useLocalStorage } from "./state/useLocalStorage";
import { Organizations } from "./Organizations";
import { TranslationProvider } from "./translation/TranslationContext";
import { checkToken } from "./clients/auth";
import { NestedRoutes } from "@nanokit/router/routes/nested";
import { FoldersProvider } from "./folders/FoldersContext";
import Loader from "./elements/Loader";

const history = createHistory({
  routes,
});

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
        <Router history={history}>
          <SignedIn>
            <FrontPage>
              <Organizations preset={organization} />
            </FrontPage>
            <PanelPage>
              <Preload />
              <FoldersProvider>
                <AppConfigProvider>
                  <IdGenerator>
                    <FieldFocusProvider>
                      <DragDropContext>
                        <NestedRoutes />
                      </DragDropContext>
                    </FieldFocusProvider>
                  </IdGenerator>
                </AppConfigProvider>
              </FoldersProvider>
            </PanelPage>
          </SignedIn>
          <SignedOut>
            <SignIn />
          </SignedOut>
        </Router>
      </TranslationProvider>
    </div>
  );
}

function FrontPage({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();

  const isLoading = useRouterIsLoading();

  if (isLoading) {
    return (
      <div className="w-full h-full flex-center">
        <Loader size="lg" />
      </div>
    );
  }

  return pathname === "/" || pathname === "logout" ? <>{children}</> : null;
}

function PanelPage({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();

  return pathname === "/" || pathname === "logout" ? null : <>{children}</>;
}
