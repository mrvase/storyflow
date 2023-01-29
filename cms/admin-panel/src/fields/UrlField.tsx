import React from "react";
import { FieldProps } from "./RenderField";
import { useGlobalContext } from "../state/context";
import { addImport } from "../custom-events";
import { SWRClient, useClient } from "../client";
import {
  Computation,
  DBDocument,
  DocumentId,
  EditorComputation,
  FieldId,
  TemplateFieldId,
} from "@storyflow/backend/types";
import { createId, getDocumentId, restoreId } from "@storyflow/backend/ids";
import { createQueueCache, useCollab } from "../state/collaboration";
import { targetTools, ComputationOp } from "shared/operations";
import { useSingular, useGlobalState } from "../state/state";
import { calculateFn } from "./DefaultField";
import { IconButton } from "./IconButton";
import {
  HomeIcon,
  LinkIcon,
  PlusIcon,
  StarIcon,
} from "@heroicons/react/24/outline";
import { useAppPageContext } from "../folders/AppPage";
import { Link } from "@storyflow/router";
import { useSegment } from "../layout/components/SegmentContext";
import { useTabUrl } from "../layout/utils";
import { getDocumentLabel, useArticle } from "../articles";
import { getConfig } from "shared/fieldConfig";
import { inputConfig } from "shared/inputConfig";
import cl from "clsx";
import { useArticlePageContext } from "../articles/ArticlePage";
import {
  decodeEditorComputation,
  encodeEditorComputation,
} from "shared/editor-computation";
import { calculate } from "@storyflow/backend/calculate";
import { URL_ID } from "@storyflow/backend/templates";

export const toSlug = (value: string) =>
  value
    .toLowerCase()
    .replace(/æ/g, "ae")
    .replace(/ø/g, "oe")
    .replace(/å/g, "aa")
    .replace(/\s/g, "-")
    .replace(/[^\w\/\*\-]/g, "");

const getUrlStringFromValue = (id: string, value: Computation) => {
  const getString = (val: any[]) => {
    return Array.isArray(val) && typeof val[0] === "string" ? val[0] : "";
  };

  return getString(
    value.length === 1
      ? value
      : calculate(id, value, () => undefined, {
          returnDefaultValue: true,
        })
  );
};

const useRelatedPages = (articleId: DocumentId, initialUrl: string) => {
  const { article } = useArticle(articleId);
  const { data: list } = SWRClient.articles.getList.useQuery(article!.folder);

  const getUrl = (article: DBDocument) => {
    return (article.values[URL_ID]?.[0] as string) ?? "";
  };

  let slugs = initialUrl.split("/").slice(0, -1);

  if (slugs[0] !== "") {
    slugs.unshift("");
  }

  const parents = slugs.map((_, i, arr) => {
    const path = arr.slice(1, i + 1).join("/");
    return list?.articles.find((el) => getUrl(el) === path);
  });

  const children =
    list?.articles.filter((el) => {
      // "|| null" excludes the front page from being included among its on children
      return (
        (getUrl(el) || null)?.split("/")?.slice(0, -1)?.join("/") === initialUrl
      );
    }) ?? [];

  return [parents, children] as [DBDocument[], DBDocument[]];
};

export default function UrlField({
  id,
  value,
  version,
  fieldConfig,
  history,
}: FieldProps<"url">) {
  if (id === "") {
    return (
      <div className="text-gray-400 font-light leading-6 pt-1 pb-5">
        Intet indhold
      </div>
    );
  }

  const initialValue = React.useMemo(
    () => (value?.length > 0 ? value : getConfig("url").initialValue),
    []
  );

  const { imports } = useArticlePageContext();

  const client = useClient();

  const [output, setOutput] = useGlobalState<[string]>(
    id,
    () => calculateFn(id, initialValue, imports, client) as [string]
  );

  const url = getUrlStringFromValue(id, output);

  const actions = useCollab().mutate<ComputationOp>(
    id.slice(0, 4),
    id.slice(4)
  );

  const parentUrl = url.split("/").slice(0, -1).join("/");
  const slug = url.split("/").slice(-1)[0];

  const handleChange = (value: string) => {
    if (value === "") {
      actions.push({
        target: targetTools.stringify({
          field: "url",
          operation: "computation",
          location: "",
        }),
        ops: [
          {
            index: 1,
            insert: [[","], ""],
            remove: slug.length + 1,
          },
        ],
      });
      return;
    }
    if (value === "*") {
      actions.push({
        target: targetTools.stringify({
          field: "url",
          operation: "computation",
          location: "",
        }),
        ops: [
          {
            index: 2,
            insert: [[0, "*"]],
            remove: slug.length,
          },
        ],
      });
      return;
    }
    const newSlug = toSlug(value);
    actions.push({
      target: targetTools.stringify({
        field: "url",
        operation: "computation",
        location: "",
      }),
      ops: [
        {
          index: 2,
          insert: [newSlug],
          remove: slug.length,
        },
      ],
    });
  };

  const [values, setValues] = useGlobalContext(id.slice(0, 4), {
    param1: "",
    param2: "",
    param3: "",
  });

  const [parents, children] = useRelatedPages(
    getDocumentId(id),
    getUrlStringFromValue(id, calculateFn(id, initialValue, imports, client))
  );

  const [isFocused, setIsFocused] = React.useState(false);

  const ctx = useAppPageContext();

  React.useEffect(() => {
    if (isFocused) {
      return addImport.subscribe(
        async ({ id: externalId, templateId, imports }) => {
          if (id && imports.includes(id)) {
            console.error("Tried to add itself");
            return;
          }
          let insert = [
            {
              id: createId(1),
              fref: externalId as FieldId,
              ...(templateId && { pick: templateId as TemplateFieldId }),
              args: {},
            },
          ];
          actions.push({
            target: targetTools.stringify({
              field: "url",
              operation: "computation",
              location: "",
            }),
            ops: [
              {
                index: 0,
                insert: [...insert, [","]],
                remove: 2,
              },
            ],
          });
        }
      );
    }
  }, [isFocused, value]);

  const singular = useSingular(id);

  const collab = useCollab();

  React.useLayoutEffect(() => {
    const queue = collab
      .getOrAddQueue(id.slice(0, 4), id.slice(4), {
        transform: (a) => a,
      })
      .initialize(version, history ?? []);

    const cache = createQueueCache(
      encodeEditorComputation(initialValue, getConfig("url").transform)
    );

    return queue.register(({ forEach }) => {
      singular(() => {
        const result = cache(forEach, (prev, { operation }) => {
          return inputConfig.getNextState(
            prev as Computation,
            operation
          ) as EditorComputation;
        });

        setOutput(
          () =>
            calculateFn(
              id,
              decodeEditorComputation(result, getConfig("url").transform),
              imports,
              client
            ) as [string]
        );
      });
    });
  }, [client]); /*
  const { folders } = useFolders();
  
    const options =
      folders?.map((el) => ({
        label: el.label,
        value: el.id,
      })) ?? [];

    const { data } = SWRClient.articles.getList.useQuery(folder, {
      inactive: !folder,
    });

    const first = data?.articles?.[0]?.fields?.[1];
    */

  const { current } = useSegment();
  const [, navigateTab] = useTabUrl();

  const replacePage = (id: string) =>
    navigateTab(
      `${current.split("/").slice(0, -1).join("/")}/d-${restoreId(id)}`,
      { navigate: false }
    );

  let parentSlugs = parentUrl.split("/");
  if (parentSlugs[0] !== "") {
    parentSlugs.unshift("");
  }

  return (
    <div className="mt-2 px-5">
      <div className="px-8">
        <div className="outline-none pl-3 h-10 border rounded border-yellow-300/50 dark:border-yellow-300/50 bg-white/5 font-light flex items-center">
          {parentSlugs.map((el, index) => (
            <React.Fragment key={parents[index]?.id}>
              <Link
                to={replacePage(parents[index]?.id ?? "")}
                className={cl(
                  "cursor-default rounded-full bg-gray-600 truncate text-sm shrink-0 hover:ring-2 ring-teal-600 transition-shadow",
                  index === 0 ? "p-1.5" : "py-0.5 px-3"
                )}
              >
                {el || <HomeIcon className="w-3 h-3" />}
              </Link>
              <div
                className={cl(
                  "px-1.5 text-white/50 text-sm transition-opacity",
                  index === parentSlugs.length - 1 && slug === "" && "opacity-0"
                )}
              >
                /
              </div>
            </React.Fragment>
          ))}
          {slug === "*" && (
            <button
              className="px-1.5 h-5 bg-sky-900 rounded-full shrink-0 flex-center mr-1.5"
              onMouseDown={(ev) => {
                ev.preventDefault();
                ev.stopPropagation();
                addImport.dispatch({ id: "ctx:param1" as any, imports: [] });
              }}
            >
              <StarIcon className="w-3 h-3 mr-1" />{" "}
              <LinkIcon className="w-3 h-3 opacity-50" />
            </button>
          )}
          <input
            type="text"
            className={cl("w-full bg-transparent outline-none")}
            value={slug === "*" ? "" : slug}
            onChange={(ev) => handleChange(ev.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onKeyDown={(ev) => {
              if (slug === "*" && ev.key === "Backspace") {
                handleChange("");
              }
            }}
          />
          {slug === "*" && (
            <input
              type="text"
              placeholder="indtast slug-eksempel"
              className="w-full bg-transparent outline-none font-light border border-gray-600 rounded px-2 text-sm py-0.5"
              value={values.param1}
              onChange={(ev) => {
                setValues({ param1: ev.target.value });
              }}
            />
          )}
          <IconButton
            onMouseDown={(ev) => {
              ev.preventDefault();
              ev.stopPropagation();
              addImport.dispatch({ id, imports: [] });
            }}
            icon={LinkIcon}
          />
        </div>
        {id.slice(4, 8) === URL_ID.slice(0, 4) && (
          <div className="mt-5">
            <div className="dark:text-gray-300 text-sm mb-1.5">Undersider</div>
            <div className="flex items-center flex-wrap gap-2">
              {children.map((el) => (
                <Link
                  key={el.id}
                  to={replacePage(el.id)}
                  className="px-3 py-0.5 rounded-full bg-yellow-300 text-black text-sm font-light hover:ring-2 ring-teal-600 transition-shadow"
                >
                  {getDocumentLabel(el)}
                </Link>
              ))}
              <button
                className="p-1 rounded-full bg-yellow-300 text-black text-sm font-light hover:ring-2 ring-teal-600 transition-shadow"
                onClick={() =>
                  ctx.addArticleWithUrl({ id, value: initialValue })
                }
              >
                <PlusIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
