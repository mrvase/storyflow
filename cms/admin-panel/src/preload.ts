import { useClient, useQueryContext } from "./client";
import { hexColorToRgb } from "./utils/colors";
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

  /*
  const client = useClient();
  const ctx = useQueryContext();
  
  React.useLayoutEffect(() => {
    const cache = provider();
    if (!preloaded) {
      preloaded = true;
      (async () => {
        const data = await client.documents.getList.query(TEMPLATE_FOLDER);
        const result = unwrap(data);
        if (result) {
          result.articles.forEach((article) => {
            const key = queryKey(`${API_URL}/articles/get`, article._id, ctx);
            const exists = cache.get(key);
            if (!exists) {
              cache.set(key, {
                data: {
                  article,
                  histories: {},
                },
                isValidating: false,
                isLoading: false,
                error: undefined,
              });
            }
          });
        }
      })();
    }
  }, []);
  */

  return null;
}
