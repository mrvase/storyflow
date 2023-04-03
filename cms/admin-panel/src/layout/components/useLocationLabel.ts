import { useArticle, useOptimisticDocumentList } from "../../documents";
import { useDocumentLabel } from "../../documents/useDocumentLabel";
import { useFolder } from "../../folders/collab/hooks";
import { parseSegment } from "./routes";

export default function useLocationLabel(segment: string) {
  const data = parseSegment(segment);

  const { articles: listData, error: listError } = useOptimisticDocumentList(
    data.type === "folder" || data.type === "app" ? data.id : undefined
  );

  let { article, error: articleError } = useArticle(
    data.type === "document" || data.type === "template" ? data.id : undefined
  );

  const loadingState = {
    type: "loading",
    label: "",
  };

  const articleLabel = useDocumentLabel(article);

  if (data.type === "folder" || data.type === "app") {
    const folder = useFolder(data.id);

    const loading = !listData && !listError;

    if (loading) return loadingState;

    if (folder?.label) {
      return {
        type: data.type,
        label: folder.label,
      };
    }
  } else if (data.type === "document" || data.type === "template") {
    const loading = !article && !articleError;

    if (loading) return loadingState;

    if (articleLabel) {
      return {
        type: data.type,
        label: articleLabel,
      };
    }
  } else if (data.type === "field") {
    return {
      type: "field",
      label: "Komponent",
    };
  }

  return {
    type: "home",
    label: "",
  };
}
