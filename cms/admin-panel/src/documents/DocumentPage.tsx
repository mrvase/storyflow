import {
  ArrowUpTrayIcon,
  BoltIcon,
  DocumentDuplicateIcon,
  DocumentIcon,
  PlusIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { extendPath } from "@storyflow/backend/extendPath";
import { DEFAULT_FIELDS, DEFAULT_TEMPLATES } from "@storyflow/backend/fields";
import { getTemplateDocumentId } from "@storyflow/backend/ids";
import {
  DBDocument,
  DocumentId,
  FolderId,
  RawFieldId,
  SearchableProps,
} from "@storyflow/backend/types";
import { NoList, useDragItem } from "@storyflow/dnd";
import { PropConfigArray } from "@storyflow/frontend/types";
import { ServerPackage } from "@storyflow/state";
import cl from "clsx";
import React from "react";
import { useDocument, useOptimisticDocumentList, useSaveDocument } from ".";
import { useDocumentLabel } from "./useDocumentLabel";
import { getComponentType, useClientConfig } from "../client-config";
import { useTemplateFolder } from "../folders/FoldersContext";
import Content from "../layout/components/Content";
import {
  useDocumentCollab,
  useDocumentMutate,
} from "./collab/DocumentCollabContext";
import { useFolder } from "../folders/collab/hooks";
import { useDocumentConfig } from "./collab/hooks";
import { FocusOrchestrator, useFocusedIds } from "../utils/useIsFocused";
import { DocumentPageContext } from "./DocumentPageContext";
import { GetDocument } from "./GetDocument";
import { RenderTemplate } from "./RenderTemplate";
import { useFieldIdGenerator } from "../id-generator";
import {
  FieldToolbarPortalProvider,
  useFieldToolbarPortal,
} from "./FieldToolbar";
import { SWRClient } from "../client";
import { ExtendTemplatePath } from "./TemplatePathContext";
import { useRoute } from "../panel-router/Routes";
import { parseSegment } from "../layout/components/routes";
import { Menu } from "../layout/components/Menu";
import { DocumentOperation } from "shared/operations";

export const getVersionKey = (versions?: Record<RawFieldId, number>) => {
  if (!versions) return -1;
  const values = Object.values(versions);
  if (!values.length) return -1;
  return values.reduce((a, c) => a + c);
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
  label,
  children,
  isModified: initialIsModified,
  variant,
  version,
  toolbar,
}: {
  id: DocumentId;
  folder: FolderId | undefined;
  label: string;
  children: React.ReactNode;
  isModified: boolean;
  variant?: string;
  version: number;
  toolbar: React.ReactNode;
}) => {
  const isModified = useIsModified(id, initialIsModified, version);

  return (
    <Content
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
          {folder && <SaveButton id={id} folder={folder} />}
        </div>
      }
      toolbar={toolbar}
    >
      {children}
    </Content>
  );
};

function Toolbar({ id }: { id: DocumentId }) {
  const ids = useFocusedIds();

  const generateFieldId = useFieldIdGenerator();

  if (ids.length > 1) {
    return (
      <Content.Toolbar>
        <div className="h-6 px-2 flex-center gap-1.5 rounded dark:bg-yellow-400/10 dark:text-yellow-200/75 ring-1 ring-yellow-200/50 text-xs whitespace-nowrap">
          {ids.length} valgt
          <XMarkIcon className="w-3 h-3" />
        </div>
      </Content.Toolbar>
    );
  }

  const setPortal = useFieldToolbarPortal();

  const fields = [
    {
      label: DEFAULT_FIELDS.label.label,
      item: () => ({
        template: getTemplateDocumentId(DEFAULT_FIELDS.label.id),
      }),
    },
    {
      label: DEFAULT_FIELDS.slug.label,
      item: () => ({
        template: getTemplateDocumentId(DEFAULT_FIELDS.slug.id),
      }),
    },
    {
      label: DEFAULT_FIELDS.published.label,
      item: {
        template: getTemplateDocumentId(DEFAULT_FIELDS.published.id),
      },
    },
    {
      label: DEFAULT_FIELDS.released.label,
      item: {
        template: getTemplateDocumentId(DEFAULT_FIELDS.released.id),
      },
    },
    {
      label: DEFAULT_FIELDS.user.label,
      item: {
        template: getTemplateDocumentId(DEFAULT_FIELDS.user.id),
      },
    },
  ];

  return (
    <>
      <div ref={setPortal} />
      {ids.length === 0 && (
        <Content.Toolbar>
          <NoList>
            <DragButton
              label={"Indsæt felt"}
              item={() => ({
                id: generateFieldId(id),
                label: "",
              })}
            />
            <Menu
              as={Content.ToolbarButton}
              label="Indsæt specialfelt"
              icon={BoltIcon}
            >
              {fields.map((el) => (
                <DragOption key={el.label} {...el} />
              ))}
            </Menu>
            <TemplateMenu id={id} />
          </NoList>
        </Content.Toolbar>
      )}
    </>
  );
}

export function TemplateMenu({ id }: { id?: DocumentId }) {
  const templateFolder = useTemplateFolder()?._id;
  const { documents: templates } = useOptimisticDocumentList(templateFolder);

  return (
    <Menu
      as={Content.ToolbarButton}
      label={"Indsæt skabelon"}
      icon={DocumentDuplicateIcon}
    >
      {(templates ?? []).map((el) => (
        <React.Fragment key={el._id}>
          {el._id === id ? null : (
            <DragOption
              label={el.label ?? el._id}
              item={{
                template: el._id,
              }}
            />
          )}
        </React.Fragment>
      ))}
    </Menu>
  );
}

export function DocumentPage({ children }: { children?: React.ReactNode }) {
  const route = useRoute();
  const segment = parseSegment<"document" | "template">(route);
  let { doc, histories, error } = useDocument(segment.id);

  React.useEffect(() => {
    console.log("DOC DOC DOC", doc);
  }, [doc]);

  return (
    <>
      {!error && doc && (
        <Page type={segment.type} doc={doc} histories={histories}>
          {children}
        </Page>
      )}
      {!error && !doc && <div className=""></div>}
    </>
  );
}

const Page = ({
  type,
  doc,
  histories,
  children,
}: {
  type: "template" | "document";
  doc: DBDocument;
  histories: Record<string, ServerPackage<DocumentOperation>[]>;
  children: React.ReactNode;
}) => {
  const id = doc._id;

  const config = useDocumentConfig(id, {
    config: doc.config,
    history: histories[id] ?? [],
    version: doc.versions?.config ?? 0,
  });

  const folder = useFolder(doc.folder);
  const isApp = folder?.type === "app";

  const templateId = folder?.template;

  const owner = doc;

  const label = useDocumentLabel(doc);

  const isModified = Object.keys(histories ?? {}).length > 0;

  const ctx = React.useMemo(
    () => ({
      id,
      record: doc.record,
      versions: doc.versions,
    }),
    [id, doc.record]
  );

  return (
    <FieldToolbarPortalProvider>
      <DocumentPageContext.Provider value={ctx}>
        <FocusOrchestrator>
          <DocumentContent
            version={getVersionKey(doc.versions)}
            id={id}
            variant={type === "template" ? "template" : undefined}
            folder={doc?.folder}
            label={label ?? "Ingen label"}
            isModified={isModified}
            toolbar={<Toolbar id={id} />}
          >
            <div className="pb-96 flex flex-col -mt-6">
              {isApp && !templateId && config.length === 0 && (
                <TemplateSelect documentId={doc._id} />
              )}
              <ExtendTemplatePath template={owner._id}>
                {templateId && (
                  <GetDocument id={templateId}>
                    {(doc) => (
                      <RenderTemplate
                        key={getVersionKey(owner.versions)} // for rerendering
                        id={doc._id}
                        config={doc.config}
                        owner={owner._id}
                        versions={owner.versions}
                        histories={histories}
                        index={null}
                      />
                    )}
                  </GetDocument>
                )}
              </ExtendTemplatePath>
              <RenderTemplate
                key={getVersionKey(owner.versions)} // for rerendering
                id={owner._id}
                config={config}
                owner={owner._id}
                versions={owner.versions}
                histories={histories}
                index={null}
              />
            </div>
          </DocumentContent>
        </FocusOrchestrator>
        {children}
      </DocumentPageContext.Provider>
    </FieldToolbarPortalProvider>
  );
};

function TemplateSelect({ documentId }: { documentId: DocumentId }) {
  const { push } = useDocumentMutate<DocumentOperation>(documentId, documentId);

  return (
    <div className="py-5 px-14 grid grid-cols-3 gap-5">
      {[
        DEFAULT_TEMPLATES.staticPage,
        DEFAULT_TEMPLATES.dynamicPage,
        DEFAULT_TEMPLATES.redirectPage,
      ].map(({ label, _id }) => (
        <button
          key={_id}
          className="rounded bg-button ring-button p-5 text-center"
          onClick={() => {
            push([
              "",
              [
                {
                  index: 0,
                  insert: [{ template: _id }],
                },
              ],
            ]);
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function SaveButton({ id, folder }: { id: DocumentId; folder: FolderId }) {
  const collab = useDocumentCollab();
  const [isLoading, setIsLoading] = React.useState(false);
  const saveDocument = useSaveDocument(folder);

  const { mutate: mutateUpdatedUrls } =
    SWRClient.documents.getUpdatedUrls.useQuery(
      {
        namespace: folder,
      },
      {
        immutable: true,
      }
    );

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
        className="relative z-0 bg-button-teal ring-button-teal text-button rounded px-3 py-1 flex-center gap-2 text-sm overflow-hidden"
        onClick={async () => {
          if (isLoading) return;
          setIsLoading(true);
          await collab.sync(true);
          const result = await saveDocument({ id, searchable });
          mutateUpdatedUrls();
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
    <Menu.Item
      ref={ref as React.MutableRefObject<HTMLButtonElement | null>}
      {...dragHandleProps}
      label={label}
      className="cursor-grab"
    />
  );
}
