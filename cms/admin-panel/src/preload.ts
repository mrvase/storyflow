import { useClient, useQueryContext } from "./client";
import { hexColorToRgb } from "./data/colors";
import useSWR from "swr";
import { TEMPLATE_FOLDER } from "@storyflow/backend/constants";
import { useOptimisticDocumentList } from "./documents";

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

  // preload articles
  useOptimisticDocumentList(TEMPLATE_FOLDER);

  return null;
}
