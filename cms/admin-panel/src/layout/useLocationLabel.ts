import { useArticle, useDocumentLabel } from "../articles";
import { SWRClient } from "../client";
import { useFolders } from "../folders/folders-context";
import { minimizeId } from "@storyflow/backend/ids";
import { getPathFromSegment } from "./utils";

export default function useLocationLabel(segment: string) {
  const path = getPathFromSegment(segment);
  const [type, urlId] = path.split("/").slice(-1)[0].split("-");
  const id = urlId ? minimizeId(urlId) : "";

  const { data: listData, error: listError } =
    SWRClient.articles.getList.useQuery(id, {
      inactive: type !== "f" && type !== "a",
    });

  let { article, error: articleError } = useArticle(id, {
    inactive: type !== "d" && type !== "t",
  });

  const { folders, error: folderError } = useFolders();

  const loadingState = {
    type: "loading",
    label: "",
  };

  const articleLabel = useDocumentLabel(article);

  if (type === "f" || type === "a") {
    const loading = (!listData && !listError) || (!folders && !folderError);

    const folder = folders?.find((el) => el.id === id);

    if (loading) return loadingState;

    if (folder?.label) {
      return {
        type: type === "a" ? "app" : "folder",
        label: folder.label,
      };
    }
  } else if (type === "d" || type === "t") {
    const loading = !article && !articleError;

    if (loading) return loadingState;

    if (articleLabel) {
      return {
        type: type === "t" ? "template" : "data",
        label: articleLabel,
      };
    }
  } else if (type === "c") {
    return {
      type: "component",
      label: "Komponent",
    };
  }

  return {
    type: "home",
    label: "",
  };
}
