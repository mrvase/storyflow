import { hexColorToRgb } from "./data/colors";
import useSWR from "swr";
import { TEMPLATE_FOLDER } from "@storyflow/fields-core/constants";
import { useDocumentList } from "./documents";
import { useCollab } from "./collab/CollabContext";
import React from "react";
import { SWRClient } from "./client";
import { FoldersProvider } from "./folders/FoldersContext";

export const DataProvider = ({ children }: { children: React.ReactNode }) => {
  const collab = useCollab();

  React.useLayoutEffect(() => {
    // prefetched
    collab.initializeTimeline("folders");

    // initialized immediately (no external data)
    collab.initializeTimeline("documents", { versions: null });
  }, [collab]);

  React.useLayoutEffect(() => {
    const timeline = collab.getTimeline("documents")!;
    timeline.registerStaleListener(() => {
      timeline.initialize(
        async () => [],
        { versions: null },
        { resetLocalState: true, keepListeners: true }
      );
    });
  }, [collab]);

  const { data: folders } = SWRClient.folders.get.useQuery(undefined, {
    onSuccess(data) {
      collab.initializeTimeline("folders", { versions: data.version });
    },
  });

  if (!folders) return null;

  return <FoldersProvider folders={folders.record}>{children}</FoldersProvider>;
};

export function Preload() {
  useSWR(
    "COLORS",
    () =>
      fetch("/colors.json").then(async (r) => {
        const json = await r.json();
        const colors: number[] = [];
        const names: string[] = [];
        json.forEach(([el, name]: [string, string]) => {
          colors.push(...hexColorToRgb(el));
          names.push(name);
        });
        return [new Uint8Array(colors), names] as const;
      }),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      revalidateIfStale: false,
    }
  );

  // preload templates
  useDocumentList(TEMPLATE_FOLDER);

  return null;
}
