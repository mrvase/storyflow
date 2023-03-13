import { useArticle } from "../documents";
import { useDocumentLabel } from "../documents/useDocumentLabel";
import { SWRClient } from "../client";
import { getPathFromSegment } from "./utils";
import { useFolder } from "../folders/collab/hooks";
import { DocumentId, FolderId } from "@storyflow/backend/types";

export default function useLocationLabel(segment: string) {
  const path = getPathFromSegment(segment);
  const [type, urlId] = path.split("/").slice(-1)[0].split("-");
  const id = urlId ?? "";

  const { data: listData, error: listError } =
    SWRClient.documents.getList.useQuery(id, {
      inactive: type !== "f" && type !== "a",
    });

  let { article, error: articleError } = useArticle(id as DocumentId, {
    inactive: type !== "d" && type !== "t",
  });

  const loadingState = {
    type: "loading",
    label: "",
  };

  const articleLabel = useDocumentLabel(article);

  if (type === "f" || type === "a") {
    const folder = useFolder(id as FolderId);

    const loading = !listData && !listError;

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
