import {
  ArrowUpTrayIcon,
  BoltIcon,
  DocumentDuplicateIcon,
  DocumentIcon,
  PlusIcon,
  XMarkIcon,
} from "@heroicons/react/24/solid";
import { DEFAULT_FIELDS } from "@storyflow/cms/default-fields";
import {
  createTemplateFieldId,
  getDocumentId,
  getRawFieldId,
  getTemplateDocumentId,
  isTemplateDocument,
} from "@storyflow/cms/ids";
import type { DocumentId, FolderId, RawFieldId } from "@storyflow/shared/types";
import type { DBDocument } from "@storyflow/cms/types";
import { NoList, useDragItem } from "@storyflow/dnd";
import cl from "clsx";
import React, { use } from "react";
import { useDocumentList, useDocumentWithTimeline } from ".";
import { DEFAULT_TEMPLATES } from "./templates";
import { useSaveDocument } from "./useSaveDocument";
import { getDocumentLabel, useDocumentLabel } from "./useDocumentLabel";
import { useTemplateFolder } from "../folders/FoldersContext";
import Content from "../pages/Content";
import { collab, usePush } from "../collab/CollabContext";
import { useDocumentConfig } from "./document-config";
import { FocusOrchestrator, useFocusedIds } from "../utils/useIsFocused";
import { DocumentPageContext } from "./DocumentPageContext";
import { GetDocument } from "./GetDocument";
import { RenderTemplate } from "./RenderTemplate";
import { useFieldIdGenerator } from "../id-generator";
import { ExtendTemplatePath } from "./TemplatePathContext";
import { Menu } from "../elements/Menu";
import {
  DocumentTransactionEntry,
  FieldTransactionEntry,
} from "../operations/actions";
import { useCurrentFolder } from "../folders/FolderPageContext";
import { getFolderData } from "../folders/getFolderData";
import { query } from "../clients/client";
import { useImmutableQuery } from "@nanorpc/client/swr";
import { useRoute } from "@nanokit/router";
import { parseMatch } from "../layout/components/parseSegment";
import { TEMPLATE_FOLDER } from "@storyflow/cms/constants";
import { DragIcon } from "../elements/DragIcon";
import { EditableLabel } from "../elements/EditableLabel";
import { useDefaultState } from "../fields/default/useDefaultState";
import { createTransaction } from "@storyflow/collab/utils";
import { ImportData, useImportContext } from "../folders/ImportContext";
import { useLocalStorage } from "../state/useLocalStorage";
import { BlockButton } from "../elements/BlockButton";

function useIsModified(id: DocumentId) {
  const [isModified, setIsModified] = React.useState(false);

  React.useEffect(() => {
    return collab.getTimeline(id)!.registerMutationListener((isModified) => {
      setIsModified(isModified);
    });
  }, []);

  return isModified;
}

function SecondaryToolbar({ id }: { id: DocumentId }) {
  const ids = useFocusedIds();

  const generateFieldId = useFieldIdGenerator();

  const fields = [
    {
      label: DEFAULT_FIELDS.label.label,
      item: {
        template: getTemplateDocumentId(DEFAULT_FIELDS.label.id),
      },
    },
    {
      label: DEFAULT_FIELDS.slug.label,
      item: {
        template: getTemplateDocumentId(DEFAULT_FIELDS.slug.id),
      },
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
    {
      label: DEFAULT_FIELDS.og_image.label,
      item: {
        template: getTemplateDocumentId(DEFAULT_FIELDS.og_image.id),
      },
    },
  ];

  return (
    <Content.SecondaryToolbar>
      <NoList>
        <Content.ToolbarDragButton
          id="new-field"
          type="fields"
          icon={DragIcon}
          label="Standardfelt"
          item={() => ({
            id: generateFieldId(id),
            label: "",
          })}
          secondary
        />
        <Menu
          as={Content.ToolbarButton}
          label="Specialfelter"
          icon={BoltIcon}
          secondary
          align="bottom-left"
        >
          {fields.map((el) => (
            <Menu.DragItem
              key={el.label}
              icon={DragIcon}
              type="fields"
              id={`ny-blok-${el.item.template}`}
              {...el}
            />
          ))}
        </Menu>
        <TemplateMenu id={id} />
      </NoList>
    </Content.SecondaryToolbar>
  );
}

function EditableTemplateLabel({ documentId }: { documentId: DocumentId }) {
  const fieldId = createTemplateFieldId(
    documentId,
    DEFAULT_FIELDS.template_label.id
  );

  const { value } = useDefaultState(fieldId);

  const label = React.useMemo(() => {
    if (value && Array.isArray(value) && typeof value[0] === "string") {
      return value[0];
    }
    return "";
  }, [value]);

  const push = usePush<FieldTransactionEntry>(
    documentId,
    getRawFieldId(fieldId)
  );

  const onChange = React.useCallback(
    (newValue: string) => {
      push(
        createTransaction((t) => {
          return t.target(fieldId).splice({
            index: 0,
            remove: label.length,
            insert: [newValue],
          });
        })
      );
    },
    [push, label]
  );

  return (
    <EditableLabel
      value={label}
      onChange={onChange}
      className="font-medium text-teal-500"
      large
    />
  );
}

export function TemplateMenu({ id }: { id?: DocumentId }) {
  const { documents: templates } = useDocumentList(TEMPLATE_FOLDER);

  return (
    <Menu
      as={Content.ToolbarButton}
      label={"Skabeloner"}
      icon={DocumentDuplicateIcon}
      secondary
      align="bottom-left"
    >
      {(templates ?? [])
        .filter((el) => el.folder)
        .map((el) => (
          <React.Fragment key={el._id}>
            {el._id === id ? null : (
              <Menu.DragItem
                label={getDocumentLabel(el)!}
                icon={DragIcon}
                type="fields"
                id={`ny-template-${el._id}`}
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
  const parsed = parseMatch<"document" | "template">(route);
  let { doc, error } = useDocumentWithTimeline(parsed.id);

  const ctx = React.useMemo(
    () =>
      doc
        ? {
            id: doc._id,
            record: doc.record,
            versions: doc.versions,
          }
        : null,
    [doc]
  );

  return (
    <DocumentPageContext.Provider value={ctx}>
      {/*<FocusOrchestrator>*/}
      <Content hasSidebar>
        {!error && doc && <Page type={parsed.type} doc={doc} />}
        {!error && !doc && <div className=""></div>}
      </Content>
      {/*</FocusOrchestrator>*/}
      {doc ? children : null}
    </DocumentPageContext.Provider>
  );
}

const Page = ({
  type,
  doc,
}: {
  type: "template" | "document";
  doc: DBDocument;
}) => {
  const id = doc._id;

  const config = useDocumentConfig(id, {
    record: doc.record,
    config: doc.config,
    versions: doc.versions,
  });

  const folder = useCurrentFolder();
  const folderData = getFolderData(folder);

  const templateId = folder?.template;

  const isTemplate = isTemplateDocument(doc._id);

  const owner = doc;

  const { label } = useDocumentLabel(doc);

  const isModified = useIsModified(id);

  return (
    <>
      <Content.Header>
        {type === "template" ? (
          <EditableTemplateLabel documentId={id} />
        ) : (
          <span className="text-3xl font-medium">
            {label || "Unavngivet dokument"}
          </span>
        )}
        <Content.Toolbar>
          {folder && isModified && <SaveButton id={id} folderId={folder._id} />}
        </Content.Toolbar>
      </Content.Header>
      <Content.Body>
        <ImportData />
        {folderData.type === "app" &&
          !templateId &&
          config.filter(
            (el) =>
              "template" in el &&
              el.template &&
              [
                DEFAULT_TEMPLATES.staticPage,
                DEFAULT_TEMPLATES.dynamicPage,
                DEFAULT_TEMPLATES.redirectPage,
              ]
                .map((el) => el._id)
                .includes(el.template)
          ).length === 0 && <TemplateSelect documentId={doc._id} />}
        <div className="flex flex-col">
          {!isTemplate && templateId && (
            <ExtendTemplatePath template={owner._id}>
              <GetDocument id={templateId}>
                {(doc) => (
                  <RenderTemplate
                    id={doc._id}
                    config={doc.config}
                    owner={owner._id}
                    versions={owner.versions}
                    index={null}
                  />
                )}
              </GetDocument>
            </ExtendTemplatePath>
          )}
          <RenderTemplate
            id={owner._id}
            config={config}
            owner={owner._id}
            versions={owner.versions}
            index={null}
          />
          <AddFieldButton documentId={owner._id} index={config.length} />
        </div>
      </Content.Body>
      <SecondaryToolbar id={id} />
    </>
  );
};

function AddFieldButton({
  documentId,
  index,
}: {
  documentId: DocumentId;
  index: number;
}) {
  const [isOpen, setIsOpen] = useLocalStorage<boolean>("toolbar-open", true);

  const push = usePush<DocumentTransactionEntry>(documentId, "config");

  const generateFieldId = useFieldIdGenerator();

  // if (!isOpen) return null;

  return (
    <BlockButton
      icon={PlusIcon}
      onClick={() => {
        push(
          createTransaction((t) =>
            t.target("").splice({
              index,
              insert: [
                {
                  id: generateFieldId(documentId),
                  label: "",
                },
              ],
            })
          )
        );
      }}
    >
      Tilføj felt
    </BlockButton>
  );
}

function TemplateSelect({ documentId }: { documentId: DocumentId }) {
  const push = usePush<DocumentTransactionEntry>(documentId, "config");

  /*
    <div className="py-5 px-14 grid grid-cols-3 gap-5">
  <button
    key={doc._id}
    className="rounded bg-gray-100 dark:bg-gray-800 ring-button p-5 text-center"
    onClick={() => {
      push(
        createTransaction((t) =>
          t
            .target("")
            .splice({ index: 0, insert: [{ template: doc._id }] })
        )
      );
    }}
  >
    {getDocumentLabel(doc)}
  </button>
  </div>
  */

  return (
    <>
      {[
        DEFAULT_TEMPLATES.staticPage,
        DEFAULT_TEMPLATES.dynamicPage,
        DEFAULT_TEMPLATES.redirectPage,
      ].map((doc) => (
        <BlockButton
          key={doc._id}
          onClick={() => {
            push(
              createTransaction((t) =>
                t
                  .target("")
                  .splice({ index: 0, insert: [{ template: doc._id }] })
              )
            );
          }}
          icon={PlusIcon}
        >
          Tilføj {getDocumentLabel(doc)?.toLowerCase()}
        </BlockButton>
      ))}
    </>
  );
}

function SaveButton({ id, folderId }: { id: DocumentId; folderId: FolderId }) {
  const [isLoading, setIsLoading] = React.useState(false);
  const [imports, setState] = useImportContext();

  console.log("ROWS", imports);

  const saveDocument = useSaveDocument({
    documentId: id,
    folderId,
    rows: imports.state === "data" ? imports.rows : undefined,
  });

  const { revalidate } = useImmutableQuery(
    query.documents.getUpdatedPaths({
      namespace: folderId,
    })
  );

  /*
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
  */

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
          await collab.saveTimeline(id, saveDocument);
          revalidate();
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
