import React from "react";
import { useGlobalContext } from "../state/context";
import { addContext, addImport } from "../custom-events";
import type { DocumentId, FieldId, ValueArray } from "@storyflow/shared/types";
import type { DBDocument } from "@storyflow/cms/types";
import type { SyntaxTree, NestedField } from "@storyflow/cms/types";
import {
  createTemplateFieldId,
  getDocumentId,
  getRawFieldId,
} from "@storyflow/cms/ids";
import { usePush } from "../collab/CollabContext";
import { HomeIcon, LinkIcon, StarIcon } from "@heroicons/react/24/outline";
import { Link, useNavigate, usePath, useRoute } from "@nanokit/router";
import { useDocumentList } from "../documents";
import cl from "clsx";
import { useDocumentPageContext } from "../documents/DocumentPageContext";
import {
  calculate,
  calculateRootFieldFromRecord,
} from "@storyflow/cms/calculate-server";
import { DEFAULT_FIELDS, isDefaultField } from "@storyflow/cms/default-fields";
import { useDocumentIdGenerator } from "../id-generator";
import { useDefaultState } from "./default/useDefaultState";
import type { FieldProps } from "./types";
import { FieldTransactionEntry } from "../operations/actions";
import { createTransaction } from "@storyflow/collab/utils";
import { useCurrentFolder } from "../folders/FolderPageContext";
import {
  AddDocumentDialog,
  useAddDocumentDialog,
} from "../folders/AddDocumentDialog";
import { createSlug } from "../utils/createSlug";
import { getDocumentLabel } from "../documents/useDocumentLabel";

const getUrlStringFromValue = (value: ValueArray | SyntaxTree) => {
  const getString = (val: any[]) => {
    return Array.isArray(val) && typeof val[0] === "string" ? val[0] : "";
  };

  return getString(
    Array.isArray(value)
      ? value
      : calculate(value, () => undefined, { ignoreClientState: true })
    // it should not be possible to have client state here anyway
  );
};

const useRelatedPages = (initialUrl: string) => {
  const folderId = useCurrentFolder()!._id;
  const { documents: list } = useDocumentList(folderId);

  const getUrl = (doc: DBDocument) => {
    return (
      (calculateRootFieldFromRecord(
        createTemplateFieldId(doc._id, DEFAULT_FIELDS.url.id),
        doc.record
      )[0] as string) ?? ""
    );
  };

  let slugs = initialUrl.split("/").slice(0, -1);

  const parents = slugs.map((_, i, arr) => {
    const path = `/${arr.slice(1, i + 1).join("/")}`;
    return list?.find((el) => getUrl(el) === path);
  });

  const children =
    list?.filter((el) => {
      // "|| null" excludes the front page from being included among its on children
      const url = getUrl(el);
      if (url === "/") return false;
      return (url.split("/")?.slice(0, -1)?.join("/") || "/") === initialUrl;
    }) ?? [];

  return [parents, children] as [DBDocument[], DBDocument[]];
};

export default function UrlField({ id }: FieldProps) {
  const documentId = getDocumentId(id) as DocumentId;
  const { record } = useDocumentPageContext();

  const [isFocused, setIsFocused] = React.useState(false);

  const generateDocumentId = useDocumentIdGenerator();

  /*
  React.useLayoutEffect(() => {
    collab
      .getOrAddQueue<FieldOperation>(getDocumentId(id), getRawFieldId(id), {
        transform: (a) => a,
      })
      .initialize(version, history ?? []);
  }, [collab, version]);
  */

  const { value } = useDefaultState(id);

  const url = getUrlStringFromValue(value);

  const push = usePush<FieldTransactionEntry>(documentId, getRawFieldId(id));

  const parentUrl = url.split("/").slice(0, -1).join("/");
  const slug = url.split("/").slice(-1)[0];

  const handleChange = (value: string) => {
    if (value === "") {
      push(
        createTransaction((t) =>
          t.target(id).splice({
            index: 3,
            insert: [{ ",": true }, ""],
            remove: slug.length + 1,
          })
        )
      );
      return;
    }
    if (value === "*") {
      push(
        createTransaction((t) =>
          t.target(id).splice({
            index: 4,
            insert: [{ x: 0, value: "*" }],
            remove: slug.length,
          })
        )
      );
      return;
    }
    const newSlug = createSlug(value);
    push(
      createTransaction((t) =>
        t.target(id).splice({
          index: 4,
          insert: [newSlug],
          remove: slug.length,
        })
      )
    );
  };

  const [values, setValues] = useGlobalContext(getDocumentId(id), {
    param0: "",
    param1: "",
    param2: "",
  });

  const [parents, children] = useRelatedPages(
    getUrlStringFromValue(calculateRootFieldFromRecord(id, record))
  );

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
        push(
          createTransaction((t) =>
            t.target(id).splice({
              index: 0,
              insert: [parentField, { ",": true }],
              remove: 2,
            })
          )
        );
      });
    }
  }, [isFocused]);

  const navigate = useNavigate();
  const route = useRoute();

  const replacePage = (id: string) =>
    `${route.accumulated.split("/").slice(0, -1).join("/")}/${parseInt(
      id,
      16
    ).toString(16)}`;

  let parentSlugs = parentUrl.split("/");
  if (parentSlugs[0] !== "") {
    parentSlugs.unshift("");
  }

  const [dialogUrl, addDocumentWithUrl, close] = useAddDocumentDialog();
  const folder = useCurrentFolder();

  return (
    <div className="pt-0.5 px-2.5 pb-2.5">
      {folder && (
        <AddDocumentDialog
          isOpen={Boolean(dialogUrl)}
          close={close}
          folderId={folder._id}
          parentUrl={dialogUrl}
          type="app"
        />
      )}
      <div className="outline-none rounded flex items-center px-3 mb-2.5 bg-gray-50 dark:bg-gray-850 ring-button">
        <Link
          to={replacePage(parents[0]?._id ?? "")}
          className="mr-5 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100 transition-colors"
          data-focus-ignore="true"
        >
          <HomeIcon className="w-4 h-4" />
        </Link>
        <Link
          to={replacePage(parents[0]?._id ?? "")}
          className="text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100 transition-colors"
          data-focus-ignore="true"
        >
          www.kfs.dk
        </Link>
        <div className="px-2 text-gray-400 dark:text-gray-600 text-sm">/</div>
        {parentSlugs.slice(1).map((el, index) => (
          <React.Fragment key={parents[index + 1]?._id}>
            <Link
              to={replacePage(parents[index + 1]?._id ?? "")}
              className={cl(
                "truncate text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100 transition-colors shrink-0"
              )}
              data-focus-ignore="true"
            >
              {el || <HomeIcon className="w-3 h-3" />}
            </Link>
            <div
              className={cl(
                "cursor-default px-2 text-gray-400 dark:text-gray-600 text-sm transition-opacity",
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
            className="px-1.5 h-5 bg-gray-200 dark:bg-gray-700 rounded shrink-0 flex-center mr-1.5 cursor-alias"
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
            "w-full py-1.5 bg-transparent outline-none placeholder:text-gray-500"
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
            className="w-full max-w-[16rem] bg-transparent outline-none border-0 rounded px-2 text-sm py-2"
            value={values.param0}
            onChange={(ev) => {
              setValues({ param0: ev.target.value });
            }}
          />
        )}
      </div>
      {isDefaultField(id, "url") && (
        <div className="flex items-center ml-5 @3xl:hidden">
          <div className="flex flex-wrap gap-2">
            {children.map((el, index) => (
              <Link
                key={el._id}
                to={replacePage(el._id)}
                className="group text-sm flex-center gap-2"
                data-focus-ignore="true"
              >
                <SubPageLine first={index === 0} />
                <span
                  className={cl(
                    "opacity-75 group-hover:opacity-100 transition-opacity relative overflow-hidden bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded"
                    // "after:absolute after:bottom-0 after:left-0 after:right-0 after:border-b-2 after:border-green-300/50"
                  )}
                >
                  {getDocumentLabel(el)}
                </span>
              </Link>
            ))}
            <button
              className="group text-sm flex-center gap-2"
              onClick={() =>
                addDocumentWithUrl({
                  _id: documentId,
                  record,
                })
              }
              data-focus-ignore="true"
            >
              <SubPageLine first={children.length === 0} />
              <span className="text-gray-600 group-hover:text-gray-800 dark:text-gray-400 dark:group-hover:text-gray-100 transition-colors py-0.5">
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
