import React from "react";
import type { ClientConfig } from "@storyflow/frontend/types";

const ClientConfigContext = React.createContext<ClientConfig | null>(null);

export function useClientConfig() {
  const ctx = React.useContext(ClientConfigContext);
  if (!ctx) throw new Error("useClientConfig cannot find provider.");
  return ctx;
}

export function ClientConfigProvider({
  children,
}: {
  children?: React.ReactNode;
}) {
  const [config, setConfig] = React.useState<ClientConfig | null>(null);

  React.useLayoutEffect(() => {
    let isMounted = true;
    const abortController = new AbortController();
    (async () => {
      const config = await fetch("http://localhost:3000/api/config", {
        signal: abortController.signal,
      }).then((res) => res.json());
      if (isMounted) {
        console.log("CONFIG", config);
        setConfig(config);
      }
    })();
    return () => {
      isMounted = false;
      abortController.abort();
    };
  }, []);

  const safeConfig = config ?? { components: {} };

  if (!safeConfig) {
    return <div className="fixed inset-0 bg-gray-900" />;
  }

  return (
    <ClientConfigContext.Provider value={safeConfig}>
      {children}
    </ClientConfigContext.Provider>
  );
}
