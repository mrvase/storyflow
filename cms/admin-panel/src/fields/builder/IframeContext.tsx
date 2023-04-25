import {
  createEventsFromCMSToIframe,
  createEventsFromIframeToCMS,
} from "@storyflow/shared/events";
import React from "react";
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

/*
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
*/
