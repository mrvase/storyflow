import {
  createEventsFromCMSToIframe,
  createEventsFromIframeToCMS,
} from "@storyflow/frontend/events";
import React from "react";
import { useClientConfig } from "../../client-config";
import { useBranchIsFocused } from "../../layout/components/Branch";
import { useUrlInfo } from "../../users";
import { createKey } from "../../utils/createKey";

export const IframeContext = React.createContext<{
  listeners: ReturnType<typeof createEventsFromIframeToCMS>;
  dispatchers: ReturnType<typeof createEventsFromCMSToIframe>;
  iframeRef: (node: HTMLIFrameElement) => void;
  uniqueId: string;
} | null>(null);

export const IframeProvider = ({ children }: { children: React.ReactNode }) => {
  const [uniqueId] = React.useState(() => createKey());

  const listeners = React.useMemo(() => {
    const events = createEventsFromIframeToCMS();
    events.setTarget(uniqueId);
    return events;
  }, []);

  const dispatchers = React.useMemo(() => {
    const events = createEventsFromCMSToIframe();
    events.setTarget(uniqueId);
    return events;
  }, []);

  const iframeRef = React.useCallback((node: HTMLIFrameElement) => {
    if (node) {
      dispatchers.setTarget(uniqueId, node.contentWindow);
    }
  }, []);

  const ctx = React.useMemo(
    () => ({
      uniqueId,
      iframeRef,
      listeners,
      dispatchers,
    }),
    []
  );

  return (
    <IframeContext.Provider value={ctx}>{children}</IframeContext.Provider>
  );
};

export const useIframeListeners = () => {
  const ctx = React.useContext(IframeContext);
  if (!ctx)
    throw new Error(`useIframeListeners cannot find IframeContext.Provider`);
  return ctx.listeners;
};

export const useIframeDispatchers = () => {
  const ctx = React.useContext(IframeContext);
  if (!ctx)
    throw new Error(`useIframeListeners cannot find IframeContext.Provider`);
  return ctx.dispatchers;
};

export default function BuilderIframe() {
  const ctx = React.useContext(IframeContext);
  if (!ctx) throw new Error("useContext cannot find IframeContext.Provider");

  const { builderUrl } = useClientConfig();

  const { id } = useBranchIsFocused();

  const { organization } = useUrlInfo();

  return React.useMemo(
    () =>
      builderUrl ? (
        <iframe
          ref={ctx.iframeRef}
          src={`${builderUrl}?uniqueId=${ctx.uniqueId}&slug=${organization}`}
          className="w-full h-full bg-white"
          data-select={id}
        />
      ) : null,
    [id, builderUrl]
  );
}
