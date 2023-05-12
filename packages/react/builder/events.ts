import {
  createEventsFromCMSToIframe,
  createEventsFromIframeToCMS,
} from "@storyflow/shared/events";

const id =
  typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("uniqueId")!
    : "";
const parent = typeof window !== "undefined" ? window.parent : undefined;

export const listeners = createEventsFromCMSToIframe();
listeners.setTarget(id);

export const dispatchers = createEventsFromIframeToCMS();
dispatchers.setTarget(id, parent);
