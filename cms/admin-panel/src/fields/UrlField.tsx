import React from "react";
import { FieldProps } from "./RenderField";
import { useGlobalContext } from "../state/context";
import { addContext, addImport } from "../custom-events";
import { useClient } from "../client";
import {
  DBDocument,
  DocumentId,
  FieldId,
  SyntaxTree,
  ValueArray,
  NestedField,
} from "@storyflow/backend/types";
import {
  createTemplateFieldId,
  getDocumentId,
  getRawFieldId,
} from "@storyflow/backend/ids";
import { createQueueCache } from "../state/collaboration";
import {
  useDocumentCollab,
  useDocumentMutate,
} from "../documents/collab/DocumentCollabContext";
import { targetTools, ComputationOp } from "shared/operations";
import { useGlobalState } from "../state/state";
import { useSingular } from "../state/useSingular";
import { calculateFn } from "./default/calculateFn";
import { HomeIcon, LinkIcon, StarIcon } from "@heroicons/react/24/outline";
import { useAppPageContext } from "../folders/AppPageContext";
import { Link } from "@storyflow/router";
import { useArticle, useDocumentList } from "../documents";
import { getDocumentLabel } from "../documents/useDocumentLabel";
import { getConfig } from "shared/initialValues";
import { getNextState } from "shared/computation-tools";
import cl from "clsx";
import { useDocumentPageContext } from "../documents/DocumentPageContext";
import { calculate, calculateFromRecord } from "@storyflow/backend/calculate";
import { DEFAULT_FIELDS, isDefaultField } from "@storyflow/backend/fields";
import { useDocumentIdGenerator } from "../id-generator";
import { createTokenStream, parseTokenStream } from "shared/parse-token-stream";
import { usePanel, useRoute } from "../panel-router/Routes";

export const toSlug = (value: string) =>
  value
    .toLowerCase()
    .replace(/æ/g, "ae")
    .replace(/ø/g, "oe")
    .replace(/å/g, "aa")
    .replace(/\s/g, "-")
    .replace(/[^\w\/\*\-]/g, "");

const getUrlStringFromValue = (value: ValueArray | SyntaxTree) => {
  const getString = (val: any[]) => {
    return Array.isArray(val) && typeof val[0] === "string" ? val[0] : "";
  };

  return getString(
    Array.isArray(value) ? value : calculate(value, () => undefined)
  );
};

const useRelatedPages = (articleId: DocumentId, initialUrl: string) => {
  const { article } = useArticle(articleId);
  const { data: list } = useDocumentList(article?.folder);

  const getUrl = (article: DBDocument) => {
    return (
      (calculateFromRecord(
        createTemplateFieldId(article._id, DEFAULT_FIELDS.url.id),
        article.record
      )[0] as string) ?? ""
    );
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

export default function UrlField({ id, version, history }: FieldProps) {
  if (id === "") {
    return (
      <div className="text-gray-400 font-light leading-6 pt-1 pb-5">
        Intet indhold
      </div>
    );
  }

  const documentId = getDocumentId(id) as DocumentId;

  const { record } = useDocumentPageContext();

  const initialValue = React.useMemo(
    () => record[id] ?? getConfig("url").defaultValue,
    []
  );

  const client = useClient();

  const [tree, setTree] = useGlobalState<SyntaxTree>(
    `${id}#tree`,
    () => initialValue
  );

  const [output, setOutput] = useGlobalState<[string]>(
    id,
    () => calculateFn(id, initialValue, { record, client }) as [string]
  );

  const url = getUrlStringFromValue(output);

  const actions = useDocumentMutate<ComputationOp>(
    documentId,
    getRawFieldId(id)
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
    param0: "",
    param1: "",
    param2: "",
  });

  const [parents, children] = useRelatedPages(
    documentId,
    getUrlStringFromValue(calculateFromRecord(id, record))
  );

  const [isFocused, setIsFocused] = React.useState(false);

  const ctx = useAppPageContext();

  const generateDocumentId = useDocumentIdGenerator();

  React.useEffect(() => {
    if (isFocused) {
      return addImport.subscribe(async ({ id: externalId, imports }) => {
        if (id && imports.includes(id)) {
          console.error("Tried to add itself");
          return;
        }
        let parentField: NestedField = {
          id: generateDocumentId(documentId),
          field: externalId as FieldId,
          inline: true,
        };
        actions.push({
          target: targetTools.stringify({
            field: "url",
            operation: "computation",
            location: "",
          }),
          ops: [
            {
              index: 0,
              insert: [parentField, { ",": true }],
              remove: 2,
            },
          ],
        });
      });
    }
  }, [isFocused]);

  const singular = useSingular(id);

  const collab = useDocumentCollab();

  React.useLayoutEffect(() => {
    const queue = collab
      .getOrAddQueue(getDocumentId(id), getRawFieldId(id), {
        transform: (a) => a,
      })
      .initialize(version, history ?? []);

    const cache = createQueueCache(createTokenStream(initialValue));

    return queue.register(({ forEach }) => {
      singular(() => {
        const result = cache(forEach, (prev, { operation }) => {
          return getNextState(prev, operation);
        });

        const tree = parseTokenStream(result, getConfig("url").transform);

        setTree(() => tree);

        setOutput(() => calculateFn(id, tree, { record, client }) as [string]);
      });
    });
  }, [client]);

  const [, navigate] = usePanel();
  const route = useRoute();

  const replacePage = (id: string) =>
    navigate(`${route.split("/").slice(0, -1).join("/")}/d${id}`, {
      navigate: false,
    });

  let parentSlugs = parentUrl.split("/");
  if (parentSlugs[0] !== "") {
    parentSlugs.unshift("");
  }

  return (
    <div className="">
      <div className="outline-none rounded font-light flex items-center px-3 mb-2.5 bg-gray-800 ring-button">
        {/*parents[0] ? (
            <Link
              to={replacePage(parents[0]?._id ?? "")}
              className={cl(
                "cursor-default rounded-full truncate text-sm shrink-0 transition-opacity",
                "p-1 -ml-1 mr-4",
                parents[0]._id !== getDocumentId(id)
                  ? "opacity-50 hover:opacity-100"
                  : "opacity-25"
              )}
            >
              <HomeIcon className="w-4 h-4" />
            </Link>
          ) : (
            <div className="w-9 h-4" />
          )*/}
        <Link
          to={replacePage(parents[0]?._id ?? "")}
          className="mr-3 opacity-50 hover:opacity-75 transition-opacity"
          data-focus-ignore="true"
        >
          <HomeIcon className="w-4 h-4" />
        </Link>
        <Link
          to={replacePage(parents[0]?._id ?? "")}
          className="opacity-50 hover:opacity-75 transition-opacity"
          data-focus-ignore="true"
        >
          www.kfs.dk
        </Link>
        <div className="px-2 text-gray-300 dark:text-gray-600 text-sm">/</div>
        {parentSlugs.slice(1).map((el, index) => (
          <React.Fragment key={parents[index + 1]?._id}>
            <Link
              to={replacePage(parents[index + 1]?._id ?? "")}
              className={cl("truncate opacity-50 hover:opacity-75 shrink-0")}
              data-focus-ignore="true"
            >
              {el || <HomeIcon className="w-3 h-3" />}
            </Link>
            <div
              className={cl(
                "cursor-default px-2 text-gray-300 dark:text-gray-600 text-sm transition-opacity",
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
            className="px-1.5 h-5 bg-fuchsia-200 dark:bg-gray-700 rounded shrink-0 flex-center mr-1.5 cursor-alias"
            onMouseDown={(ev) => {
              ev.preventDefault();
              ev.stopPropagation();
              addContext.dispatch("param0");
            }}
          >
            <StarIcon className="w-3 h-3 mr-1" />{" "}
            <LinkIcon className="w-3 h-3 opacity-50" />
          </button>
        )}
        <input
          type="text"
          className={cl(
            "w-full py-1.5 bg-transparent outline-none placeholder:text-white/25"
          )}
          value={slug === "*" ? "" : slug}
          onChange={(ev) => handleChange(ev.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onKeyDown={(ev) => {
            if (slug === "*" && ev.key === "Backspace") {
              handleChange("");
            }
          }}
          placeholder={slug !== "*" ? "[forside]" : ""}
        />
        {slug === "*" && (
          <input
            type="text"
            placeholder="indtast eksempel"
            className="w-full max-w-[16rem] bg-transparent outline-none font-light border-0 rounded px-2 text-sm py-2"
            value={values.param0}
            onChange={(ev) => {
              setValues({ param0: ev.target.value });
            }}
          />
        )}
      </div>
      {isDefaultField(id, "url") && (
        <div className="flex items-center ml-5">
          <div className="flex flex-wrap gap-2">
            {children.map((el, index) => (
              <Link
                key={el._id}
                to={replacePage(el._id)}
                className="group text-sm font-light flex-center gap-2"
                data-focus-ignore="true"
              >
                <SubPageLine first={index === 0} />
                <span
                  className={cl(
                    "opacity-75 group-hover:opacity-100 transition-opacity relative overflow-hidden bg-gray-800 px-1.5 py-0.5 rounded"
                    // "after:absolute after:bottom-0 after:left-0 after:right-0 after:border-b-2 after:border-green-300/50"
                  )}
                >
                  {getDocumentLabel(el)}
                </span>
              </Link>
            ))}
            <button
              className="group text-sm font-light flex-center gap-2"
              onClick={() =>
                ctx.addArticleWithUrl({
                  _id: documentId,
                  record,
                })
              }
              data-focus-ignore="true"
            >
              <SubPageLine first={children.length === 0} />
              <span className="opacity-40 group-hover:opacity-100 transition-opacity py-0.5">
                Tilføj underside
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const SubPageLine = ({ first }: { first?: boolean }) => (
  <svg
    viewBox="0 0 24 16"
    className="w-6 h-4 opacity-20 group-hover:opacity-50 transition-opacity"
    strokeWidth={1}
    stroke="currentColor"
    fill="none"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d={first ? "M 1 3 L 1 9 L 23 9" : "M 1 9 L 23 9"}
    />
  </svg>
);
