import { DragDropContext } from "@storyflow/dnd";
import { Router, useLocation, useRouterIsLoading } from "@nanokit/router";
import { AppConfigProvider } from "./AppConfigContext";
import { FieldFocusProvider } from "./FieldFocusContext";
import { IdGenerator } from "./id-generator";
import { history_ } from "./pages/routes";
import { SignedIn, SignedOut, SignIn } from "./Auth";
import React from "react";
import { useLocalStorage } from "./state/useLocalStorage";
import { Organizations } from "./Organizations";
import { TranslationProvider } from "./translation/TranslationContext";
import { NestedRoutes } from "@nanokit/router/routes/nested";
import { FoldersProvider } from "./folders/FoldersContext";
import Loader from "./elements/Loader";
import { useUser } from "./clients/auth";

export function App({ lang }: { lang?: "da" | "en" }) {
  const [darkMode] = useLocalStorage<boolean>("dark-mode", true);

  React.useLayoutEffect(() => {
    document.body.classList[darkMode ? "add" : "remove"]("dark");
  }, [darkMode]);

  return (
    <div className="w-full h-full bg-gray-100 dark:bg-gray-950 text-gray-800 dark:text-white">
      <TranslationProvider lang={lang}>
        <Router history={history_}>
          <RouterIsLoading>
            <SignedIn>
              <FrontPage>
                <Organizations />
              </FrontPage>
              <PanelPage>
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
          </RouterIsLoading>
        </Router>
      </TranslationProvider>
    </div>
  );
}

const timer = (callback: () => void, ms: number) => {
  let id = setTimeout(callback, ms);
  return () => clearTimeout(id);
};

function RouterIsLoading({ children }: { children: React.ReactNode }) {
  const { isLoading: userIsLoading } = useUser();
  const routeIsLoading = useRouterIsLoading();
  const isLoading = userIsLoading || routeIsLoading;

  const [showLoader, setShowLoader] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (!isLoading) return;
    return timer(() => setShowLoader(Date.now()), 250);
  }, [isLoading]);

  React.useEffect(() => {
    if (userIsLoading || routeIsLoading) return;
    if (showLoader !== null) {
      return timer(
        () => setShowLoader(null),
        Math.max(500 - (Date.now() - showLoader, 0))
      );
    }
    setShowLoader(null);
  }, [userIsLoading, routeIsLoading, showLoader]);

  if (isLoading || showLoader) {
    return showLoader ? (
      <div className="w-full h-full flex-center">
        <Loader size="md" />
      </div>
    ) : null;
  }

  return <>{children}</>;
}

function FrontPage({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  return pathname === "/" || pathname === "/logout" ? <>{children}</> : null;
}

function PanelPage({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  return pathname === "/" || pathname === "/logout" ? null : <>{children}</>;
}
