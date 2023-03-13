import {
  ArrowUpTrayIcon,
  BoltIcon,
  CheckIcon,
  DocumentDuplicateIcon,
  DocumentIcon,
  FunnelIcon,
  ListBulletIcon,
  PencilSquareIcon,
  PlusIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { extendPath } from "@storyflow/backend/extendPath";
import { FIELDS } from "@storyflow/backend/fields";
import { getComputationRecord } from "@storyflow/backend/flatten";
import {
  computeFieldId,
  createFieldId,
  getDocumentId,
  minimizeId,
} from "@storyflow/backend/ids";
import { URL_ID } from "@storyflow/backend/templates";
import {
  DBDocument,
  DocumentConfig,
  DocumentId,
  FieldId,
  RestrictTo,
  SearchableProps,
  TemplateFieldId,
} from "@storyflow/backend/types";
import { NoList, useDragItem } from "@storyflow/dnd";
import { PropConfigArray } from "@storyflow/frontend/types";
import { ServerPackage } from "@storyflow/state";
import cl from "clsx";
import React from "react";
import { flushSync } from "react-dom";
import { DocumentConfigOp, PropertyOp, targetTools } from "shared/operations";
import { useArticle, useArticleList, useSaveArticle } from ".";
import { useDocumentLabel } from "./useDocumentLabel";
import { getComponentType, useClientConfig } from "../client-config";
import { useTemplateFolder } from "../folders/folders-context";
import Content from "../layout/components/Content";
import { useSegment } from "../layout/components/SegmentContext";
import { useOnLoadHandler } from "../layout/onLoadHandler";
import { getPathFromSegment } from "../layout/utils";
import { useDocumentCollab } from "./collab/DocumentCollabContext";
import { useFolder } from "../folders/collab/hooks";
import { useDocumentConfig, useFieldConfig, useLabel } from "./collab/hooks";
import { FocusOrchestrator, useFocusedIds } from "../utils/useIsFocused";
import { DocumentPageContext } from "./DocumentPageContext";
import { GetDocument } from "./GetDocument";
import { RenderTemplate } from "./RenderTemplate";

export const getVersionKey = (versions?: Record<TemplateFieldId, number>) => {
  if (!versions) return -1;
  return Object.values(versions).reduce((a, c) => a + c, 0);
};

function useIsModified(id: string, initial: boolean, key: number) {
  const [isModified, setIsModified] = React.useState(initial);

  const collab = useDocumentCollab();

  React.useEffect(() => {
    return collab.registerMutationListener((doc) => {
      if (doc === id) {
        setIsModified(true);
      }
    });
  }, []);

  React.useEffect(() => {
    setIsModified(initial);
  }, [key, initial]);

  return isModified;
}

export const DocumentContent = ({
  id,
  folder,
  selected,
  label,
  children,
  isModified: initialIsModified,
  variant,
  version,
  toolbar,
}: {
  id: DocumentId;
  folder: string | undefined;
  selected: boolean;
  label: string;
  children: React.ReactNode;
  isModified: boolean;
  variant?: string;
  version: number;
  toolbar: React.ReactNode;
}) => {
  const isModified = useIsModified(id, initialIsModified, version);

  const [isEditing] = [true]; //useLocalStorage<boolean>("editing-articles", false);

  return (
    <Content
      selected={selected}
      icon={variant === "template" ? DocumentDuplicateIcon : DocumentIcon}
      header={
        <span className={cl(variant === "template" && "text-teal-500")}>
          {label}
        </span>
      }
      buttons={
        <div
          className={cl(
            "flex-center",
            "transition-opacity",
            isModified ? "opacity-100" : "opacity-0 pointer-events-none"
          )}
        >
          <span className="text-xs opacity-50 font-light ml-5 cursor-default hover:underline">
            ændret d. 22/2 10:33
          </span>
          {folder && <SaveButton id={id} folder={folder} />}
        </div>
      }
      toolbar={isEditing ? toolbar : undefined}
    >
      {children}
    </Content>
  );
};

function Toolbar({ id, config }: { id: DocumentId; config: DocumentConfig }) {
  const ids = useFocusedIds();

  const getFieldIndex = (id: string) => {
    return config.findIndex((el) => "id" in el && el.id === id);
  };

  const index = getFieldIndex(ids[0]);

  if (index >= 0) {
    return (
      <FieldToolbar
        // needed because it relies on useFieldConfig which is assumed to be static
        key={ids[0]}
        documentId={id}
        fieldId={ids[0] as FieldId}
        index={index}
      />
    );
  }

  const fields = [
    {
      label: "Label",
      item: () => ({
        ...FIELDS.label,
        id: computeFieldId(id, FIELDS.label.id),
      }),
    },
    {
      label: "Slug",
      item: () => ({
        ...FIELDS.slug,
        id: computeFieldId(id, FIELDS.slug.id),
      }),
    },
    {
      label: "Side",
      item: {
        ...FIELDS.page,
        id: computeFieldId(id, FIELDS.page.id),
      },
    },
    {
      label: "Layout",
      item: {
        ...FIELDS.layout,
        id: computeFieldId(id, FIELDS.layout.id),
      },
    },
    {
      label: "Omdirigering",
      item: {
        ...FIELDS.redirect,
        id: computeFieldId(id, FIELDS.redirect.id),
      },
    },
    {
      label: "Offentlig",
      item: {
        ...FIELDS.published,
        id: computeFieldId(id, FIELDS.published.id),
      },
    },
    {
      label: "Udgivelsesdato",
      item: {
        ...FIELDS.released,
        id: computeFieldId(id, FIELDS.released.id),
      },
    },
    {
      label: "Bruger",
      item: {
        ...FIELDS.user,
        id: computeFieldId(id, FIELDS.user.id),
      },
    },
  ];
  return (
    <Content.Toolbar>
      <NoList>
        <DragButton
          label={"Indsæt felt"}
          item={() => ({
            id: createFieldId(id),
            label: "",
            type: "default",
          })}
        />
        <Content.ToolbarMenu label={"Indsæt specialfelt"} icon={BoltIcon}>
          {fields.map((el) => (
            <DragOption key={el.label} {...el} />
          ))}
        </Content.ToolbarMenu>
        <TemplateMenu id={id} />
      </NoList>
    </Content.Toolbar>
  );
}

export function TemplateMenu({ id }: { id?: DocumentId }) {
  const templateFolder = useTemplateFolder()?.id;
  const { articles: templates } = useArticleList(templateFolder);

  return (
    <Content.ToolbarMenu label={"Indsæt skabelon"} icon={BoltIcon}>
      {(templates ?? []).map((el) => (
        <React.Fragment key={el.id}>
          {el.id === id ? null : (
            <DragOption
              label={el.label ?? el.id}
              item={{
                template: el.id,
              }}
            />
          )}
        </React.Fragment>
      ))}
    </Content.ToolbarMenu>
  );
}

export function FieldToolbar({
  documentId,
  fieldId,
  index,
}: {
  documentId: DocumentId;
  fieldId: FieldId;
  index?: number;
}) {
  const [config, setConfig] = useFieldConfig(fieldId);

  const { push } = useDocumentCollab().mutate<DocumentConfigOp>(
    documentId,
    documentId
  );

  const templateFolder = useTemplateFolder()?.id;
  const { articles: templates } = useArticleList(templateFolder);

  const templateOptions = (templates ?? []).map((el) => ({
    id: el.id,
    label: el.label ?? el.id,
  }));

  const restrictToOptions = [
    { id: "number" as "number", label: "Tal" },
    { id: "image" as "image", label: "Billede" },
    { id: "color" as "color", label: "Farve" },
  ];

  return (
    <Content.Toolbar>
      <FieldLabel id={fieldId} template={documentId} />
      <Content.ToolbarMenu<{ id: DocumentId; label: string }>
        icon={ListBulletIcon}
        label="Vælg skabelon"
        onSelect={(el) => setConfig("template", el.id)}
        onClear={() => setConfig("template", undefined)}
        selected={
          config?.template
            ? templateOptions.find((el) => el.id === config.template)
            : undefined
        }
        options={templateOptions}
      />
      <Content.ToolbarMenu<{ id: RestrictTo; label: string }>
        icon={FunnelIcon}
        label="Begræns til"
        onSelect={(el) => setConfig("restrictTo", el.id)}
        onClear={() => setConfig("restrictTo", undefined)}
        selected={
          config?.restrictTo
            ? restrictToOptions.find((el) => el.id === config.restrictTo)
            : undefined
        }
        options={restrictToOptions}
      />
      {typeof index === "number" && (
        <Content.ToolbarButton
          data-focus-remain="true"
          onClick={() => {
            push({
              target: targetTools.stringify({
                field: "any",
                operation: "document-config",
                location: "",
              }),
              ops: [
                {
                  index,
                  remove: 1,
                },
              ],
            });
          }}
        >
          <TrashIcon className="w-4 h-4" />
        </Content.ToolbarButton>
      )}
    </Content.Toolbar>
  );
}

function FieldLabel({ id, template }: { id: FieldId; template?: DocumentId }) {
  const label = useLabel(id, template);

  const articleId = getDocumentId(id);

  const { push } = useDocumentCollab().mutate<PropertyOp>(articleId, articleId);

  const onChange = (value: string) => {
    push({
      target: targetTools.stringify({
        field: "any",
        operation: "property",
        location: id,
      }),
      ops: [
        {
          name: "label",
          value: value,
        },
      ],
    });
  };
  return <EditableLabel label="Label" value={label} onChange={onChange} />;
}

export function EditableLabel({
  value: initialValue,
  onChange,
  className,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  label?: string;
}) {
  const ref = React.useRef<HTMLInputElement | null>(null);

  const [isEditing, setIsEditing] = React.useState(false);

  const [value, setValue] = React.useState(initialValue);

  React.useLayoutEffect(() => {
    setValue(initialValue);
    setWidth();
  }, [initialValue]);

  React.useLayoutEffect(() => setWidth(), [isEditing]);

  const setWidth = () => {
    if (ref.current) {
      ref.current.style.width = "0px";
      let value = ref.current.value;
      if (value === "") ref.current.value = "Ingen label";
      const newWidth = ref.current.scrollWidth;
      if (value === "") ref.current.value = "";
      ref.current.style.width = `${newWidth}px`;
    }
  };

  const handleChange = (ev: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = ev.target.value;
    flushSync(() => {
      setValue(newValue);
    });
    setWidth();
  };

  const rejected = React.useRef(false);

  const accept = () => {
    if (!rejected.current) {
      if (value !== initialValue) {
        onChange(value);
      }
    } else {
      rejected.current = false;
    }
  };

  const reject = () => {
    setValue(initialValue);
    rejected.current = true;
  };

  const id = React.useId();

  return (
    <div
      className={cl(
        " text-xs text-gray-300 font-light flex h-6 ring-1 rounded",
        isEditing ? "ring-gray-600" : "ring-button"
      )}
      data-focus-remain="true"
    >
      <label className="flex">
        {label && (
          <div className="h-6 px-2 flex-center bg-gray-750 rounded">
            {label}
          </div>
        )}
        <input
          id={id}
          ref={ref}
          value={isEditing ? value : initialValue}
          onChange={handleChange}
          type="text"
          className={cl(
            "outline-none padding-0 margin-0 bg-transparent h-6 items-center px-2",
            className
          )}
          placeholder="Ingen label"
          onFocus={() => {
            setIsEditing(true);
            rejected.current = false;
          }}
          onBlur={() => {
            setIsEditing(false);
            accept();
          }}
          onKeyDown={(ev) => {
            if (ev.key.toLowerCase() === "enter") {
              ref.current?.blur();
            }
            if (ev.key.toLowerCase() === "escape") {
              reject();
              ref.current?.blur();
            }
          }}
        />
        {!isEditing && (
          <div className="mr-2 h-full flex-center cursor-text">
            <PencilSquareIcon className="w-3 h-3" />
          </div>
        )}
      </label>
      {isEditing && (
        <>
          <div
            className="h-6 w-6 flex-center bg-gray-750 hover:bg-green-700/60 transition-colors rounded-l"
            onMouseDown={(ev) => {
              accept();
            }}
            onClick={(ev) => {}}
          >
            <CheckIcon className="w-3 h-3" />
          </div>
          <div
            className="h-6 w-6 flex-center bg-gray-750 hover:bg-red-700/50 transition-colors rounded-r"
            onMouseDown={(ev) => {
              reject();
            }}
            onClick={(ev) => {}}
          >
            <XMarkIcon className="w-3 h-3" />
          </div>
        </>
      )}
    </div>
  );
}

export function DocumentPage({
  isOpen,
  isSelected,
  onLoad,
  children,
}: {
  isOpen: boolean;
  isSelected: boolean;
  onLoad?: () => void;
  children?: React.ReactNode;
}) {
  const { current } = useSegment();

  const path = getPathFromSegment(current);
  const [type, articleId] = path.split("/").slice(-1)[0].split("-");

  const id = minimizeId(articleId) as DocumentId;

  let { article, histories, error } = useArticle(id);

  useOnLoadHandler(Boolean(article), onLoad);

  return (
    <>
      {!error && article && (
        <Page
          type={type === "t" ? "template" : "document"}
          isOpen={isOpen}
          article={article}
          histories={histories}
        >
          {children}
        </Page>
      )}
      {!error && !article && <div className=""></div>}
    </>
  );
}

const Page = ({
  type,
  isOpen,
  article,
  histories,
  children,
}: {
  type: "template" | "document";
  isOpen: boolean;
  article: DBDocument;
  histories: Record<string, ServerPackage<DocumentConfigOp | PropertyOp>[]>;
  children: React.ReactNode;
}) => {
  const id = article.id;

  const config = useDocumentConfig(id, {
    config: article.config,
    history: histories[id] ?? [],
    version: article.versions?.[id] ?? 0,
  });

  const folder = useFolder(article.folder);

  const templateId =
    folder?.type === "app" ? getDocumentId(URL_ID) : folder?.template;

  const owner = article;

  const label = useDocumentLabel(article);

  const isModified = Object.keys(histories ?? {}).length > 0;

  const ctx = React.useMemo(
    () => ({
      id,
      imports: article
        ? getComputationRecord(article, { includeImports: true })
        : {},
      article,
    }),
    [id, article]
  );

  return (
    <FocusOrchestrator>
      <DocumentPageContext.Provider value={ctx}>
        <DocumentContent
          version={getVersionKey(article?.versions)}
          id={id}
          variant={type === "template" ? "template" : undefined}
          folder={article?.folder}
          label={label ?? "Ingen label"}
          selected={isOpen}
          isModified={isModified}
          toolbar={<Toolbar id={id} config={config} />}
        >
          <div className="pb-96 flex flex-col -mt-6">
            {templateId && (
              <GetDocument id={templateId}>
                {(article) => (
                  <RenderTemplate
                    key={getVersionKey(owner.versions)} // for rerendering
                    id={article.id}
                    owner={owner.id}
                    values={{
                      ...getComputationRecord(article),
                      ...getComputationRecord(owner),
                    }}
                    config={article.config}
                    histories={histories}
                    versions={owner.versions}
                  />
                )}
              </GetDocument>
            )}
            <RenderTemplate
              key={getVersionKey(owner.versions)} // for rerendering
              id={owner.id}
              owner={owner.id}
              values={getComputationRecord(owner)}
              config={config}
              versions={owner.versions}
              histories={histories}
            />
          </div>
        </DocumentContent>
        {children}
      </DocumentPageContext.Provider>
    </FocusOrchestrator>
  );
};

function SaveButton({ id, folder }: { id: string; folder: string }) {
  const collab = useDocumentCollab();
  const [isLoading, setIsLoading] = React.useState(false);
  const saveArticle = useSaveArticle(folder);

  const { libraries } = useClientConfig();

  const searchable: SearchableProps = React.useMemo(() => {
    const searchableProps: SearchableProps = {};
    for (const lib of libraries) {
      for (const comp of Object.values(lib.components)) {
        const type = getComponentType(lib.name, comp.name);
        searchableProps[type] = {};
        const handleProps = (props: PropConfigArray, group?: string) => {
          for (const prop of props) {
            if (prop.type === "group") {
              handleProps(prop.props, prop.name);
              continue;
            } else {
              const name = extendPath(group ?? "", prop.name, "#");
              const searchable =
                prop.type === "children" || prop.searchable || false;
              searchableProps[type][name] = searchable;
            }
          }
        };
        handleProps(comp.props);
      }
    }
    return searchableProps;
  }, [libraries]);

  return (
    <div className="relative ml-5">
      {/*isLoading && (
        <div className="absolute inset-0 flex-center">
          <div className="w-8 h-8 bg-white/5 rounded-full animate-ping-lg" />
        </div>
      )*/}
      <button
        className="relative z-0 bg-button-teal ring-button-teal text-button rounded px-3 py-1 font-light flex-center gap-2 text-sm overflow-hidden"
        onClick={async () => {
          if (isLoading) return;
          setIsLoading(true);
          await collab.sync(true);
          const result = await saveArticle({ id, searchable });
          setIsLoading(false);
        }}
      >
        {isLoading && (
          <div className="absolute inset-0 -z-10 flex-center">
            <div className="w-8 h-8 bg-teal-300 rounded-full animate-ping-lg" />
          </div>
        )}
        <ArrowUpTrayIcon className="w-3 h-3" />
        Udgiv
      </button>
    </div>
  );
}

function DragButton({ item, label }: { label: string; item: any }) {
  const { ref, dragHandleProps, state } = useDragItem({
    id: `new-field-${label}`,
    type: "fields",
    item,
    mode: "move",
  });

  return (
    <Content.ToolbarButton
      ref={ref as React.MutableRefObject<HTMLButtonElement | null>}
      {...dragHandleProps}
      icon={PlusIcon}
      className="cursor-grab"
    >
      {label}
    </Content.ToolbarButton>
  );
}

export function DragOption({ label, item }: { label: string; item: any }) {
  const { ref, dragHandleProps } = useDragItem({
    id: `ny-blok-2-${label}`,
    type: "fields",
    item,
    mode: "move",
  });

  return (
    <Content.ToolbarMenuOption
      ref={ref as React.MutableRefObject<HTMLButtonElement | null>}
      {...dragHandleProps}
      label={label}
      className="cursor-grab"
    />
  );
}
