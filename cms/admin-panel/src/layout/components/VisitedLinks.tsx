import React from "react";
import cl from "clsx";
import type { PanelData } from "../panel-router/types";
import { fetchDocument } from "../../documents";
import { getDocumentLabel } from "../../documents/useDocumentLabel";
import { Link, useLocation } from "@storyflow/router";
import { replacePanelPath } from "../panel-router/utils";
import { useTranslation } from "../../translation/TranslationContext";

export function VisitedLinks({ data: { path, index } }: { data: PanelData }) {
  const t = useTranslation();
  const [visited, setVisited] = React.useState<
    { path: string; label: string; type: "t" | "d" }[]
  >([]);

  const prev = React.useRef<string | null>(null);

  React.useEffect(() => {
    const prevPath = prev.current;
    prev.current = path;
    if (!prevPath || prevPath === path) return;
    const last = prevPath.split("/").slice(-1)[0];
    const type = last.slice(0, 1);
    const id = last.slice(1).padStart(24, "0");
    let mounted = true;
    if (type === "d" || type === "t") {
      fetchDocument(id).then((doc) => {
        if (!mounted) return;
        const label = getDocumentLabel(doc, t);
        if (!label) return;
        setVisited((ps) =>
          [
            { path: prevPath, label, type: type as "d" | "t" },
            ...ps.filter((el) => el.path !== prevPath && el.path !== path),
          ].slice(0, 5)
        );
      });
    } else {
      setVisited((ps) =>
        ps.filter((el) => el.path !== prevPath && el.path !== path).slice(0, 5)
      );
    }
    return () => {
      mounted = false;
    };
  }, [path]);

  const { pathname } = useLocation();
  const getHref = (path: string) =>
    replacePanelPath(pathname, { path, index: 0 });

  return (
    <div className="h-7 bg-white dark:bg-gray-850 text-xs px-2 flex gap-3">
      {visited.map((el) => (
        <Link
          to={getHref(el.path)}
          key={el.path}
          className={cl(
            "h-7 flex items-center transition-colors",
            el.type === "t"
              ? "text-teal-500 hover:text-teal-700 dark:text-teal-700 dark:hover:text-teal-400"
              : "text-gray-400 hover:text-gray-600 dark:text-gray-600 dark:hover:text-gray-200"
          )}
        >
          {el.label}
        </Link>
      ))}
    </div>
  );
}
