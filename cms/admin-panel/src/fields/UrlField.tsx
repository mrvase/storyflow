import React from "react";
import { FieldProps } from "./RenderField";
import { useGlobalContext } from "../state/context";
import { addContext, addImport } from "../custom-events";
import { SWRClient, useClient } from "../client";
import {
  Computation,
  DBDocument,
  DocumentId,
  EditorComputation,
  FieldId,
  TemplateFieldId,
} from "@storyflow/backend/types";
import {
  createId,
  getDocumentId,
  getTemplateDocumentId,
  getTemplateFieldId,
  restoreId,
} from "@storyflow/backend/ids";
import { createQueueCache } from "../state/collaboration";
import { useDocumentCollab } from "../state/collab-document";
import { targetTools, ComputationOp } from "shared/operations";
import { useSingular, useGlobalState } from "../state/state";
import { calculateFn } from "./default/calculateFn";
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
import { useArticlePageContext } from "../articles/ArticlePageContext";
import {
  decodeEditorComputation,
  encodeEditorComputation,
} from "shared/editor-computation";
import { calculateSync } from "@storyflow/backend/calculate";
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
      : calculateSync(id, value, () => undefined, {
          returnFunction: false,
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

  const { article, imports } = useArticlePageContext();

  const initialValue = React.useMemo(
    () => (value?.length > 0 ? value : getConfig("url").initialValue),
    []
  );

  const client = useClient();

  const [output, setOutput] = useGlobalState<[string]>(
    id,
    () => calculateFn(id, initialValue, { imports, client }) as [string]
  );

  const url = getUrlStringFromValue(id, output);

  const actions = useDocumentCollab().mutate<ComputationOp>(
    getDocumentId(id),
    getTemplateFieldId(id)
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
            insert: [{ ",": true }, ""],
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
            insert: [{ x: 0, value: "*" }],
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

  const [values, setValues] = useGlobalContext(getDocumentId(id), {
    param1: "",
    param2: "",
    param3: "",
  });

  const [parents, children] = useRelatedPages(
    getDocumentId(id),
    getUrlStringFromValue(
      id,
      calculateFn(id, initialValue, { imports, client })
    )
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
                insert: [...insert, { ",": true }],
                remove: 2,
              },
            ],
          });
        }
      );
    }
  }, [isFocused, value]);

  const singular = useSingular(id);

  const collab = useDocumentCollab();

  React.useLayoutEffect(() => {
    const queue = collab
      .getOrAddQueue(getDocumentId(id), getTemplateFieldId(id), {
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
              { imports, client }
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
    <div className="px-5">
      <div className="pr-8">
        <div className="outline-none rounded font-light flex items-start">
          {parents[0] && parents[0].id !== getDocumentId(id) ? (
            <Link
              to={replacePage(parents[0]?.id ?? "")}
              className={cl(
                "cursor-default rounded-full truncate text-sm shrink-0 opacity-50 hover:opacity-100 transition-opacity",
                "p-1 -ml-1 mr-4"
              )}
            >
              <HomeIcon className="w-4 h-4" />
            </Link>
          ) : (
            <div className="w-9 h-4" />
          )}
          <div className="flex items-center pb-2 h-8">
            {parentSlugs.slice(1).map((el, index) => (
              <React.Fragment key={parents[index + 1]?.id}>
                <Link
                  to={replacePage(parents[index + 1]?.id ?? "")}
                  className={cl(
                    "cursor-default rounded-full bg-gray-100 dark:bg-gray-750 truncate text-sm shrink-0",
                    "px-3"
                  )}
                >
                  {el || <HomeIcon className="w-3 h-3" />}
                </Link>
                <div
                  className={cl(
                    "px-2 text-gray-300 dark:text-gray-600 text-sm transition-opacity",
                    index + 1 === parentSlugs.length - 1 &&
                      slug === "" &&
                      "opacity-0"
                  )}
                >
                  /
                </div>
              </React.Fragment>
            ))}
            {slug === "*" && (
              <button
                className="px-1.5 h-5 bg-fuchsia-200 dark:bg-fuchsia-900 rounded-full shrink-0 flex-center mr-1.5 cursor-alias"
                onMouseDown={(ev) => {
                  ev.preventDefault();
                  ev.stopPropagation();
                  addContext.dispatch("param1");
                }}
              >
                <StarIcon className="w-3 h-3 mr-1" />{" "}
                <LinkIcon className="w-3 h-3 opacity-50" />
              </button>
            )}
          </div>
          <input
            type="text"
            className={cl("w-full bg-transparent outline-none pb-2")}
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
              className="w-full bg-transparent outline-none font-light border border-gray-200 dark:border-gray-600 rounded px-2 text-sm py-0.5"
              value={values.param1}
              onChange={(ev) => {
                setValues({ param1: ev.target.value });
              }}
            />
          )}
        </div>
        {getTemplateDocumentId(id) === getDocumentId(URL_ID) && (
          <div className="flex items-center pb-5">
            <button
              className="p-1 -ml-1 mr-4 opacity-50 hover:opacity-100 transition-opacity"
              onClick={() => ctx.addArticleWithUrl(article)}
            >
              <PlusIcon className="w-4 h-4" />
            </button>
            <div className="flex flex-wrap gap-2">
              {children.map((el, index) => (
                <Link
                  key={el.id}
                  to={replacePage(el.id)}
                  className="group text-sm font-light flex-center gap-2"
                >
                  <svg
                    viewBox="0 0 24 16"
                    className="w-6 h-4 opacity-25"
                    strokeWidth={1}
                    stroke="currentColor"
                    fill="none"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d={index === 0 ? "M 1 3 L 1 9 L 23 9" : "M 1 9 L 23 9"}
                    />
                  </svg>
                  <span className="opacity-50 group-hover:opacity-100">
                    {getDocumentLabel(el)}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
