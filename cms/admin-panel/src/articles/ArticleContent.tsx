import cl from "clsx";
import { NoList, useDragItem } from "@storyflow/dnd";
import { Menu, Transition } from "@headlessui/react";
import {
  ArrowUpTrayIcon,
  DocumentDuplicateIcon,
  PlusIcon,
  ViewColumnsIcon,
} from "@heroicons/react/24/outline";
import React from "react";
import {
  LABEL_ID,
  LAYOUT_ID,
  PAGE_ID,
  PUBLISHED_ID,
  REDIRECT_ID,
  RELEASED_ID,
  SLUG_ID,
  USER_ID,
} from "@storyflow/backend/templates";
import Content from "../layout/components/Content";
import { useSegment } from "../layout/components/SegmentContext";
import { getPathFromSegment } from "../layout/utils";
import { getDocumentId, minimizeId } from "@storyflow/backend/ids";
import { targetTools, DocumentConfigOp } from "shared/operations";
import { useCollab } from "../state/collaboration";
import { FocusOrchestrator, useFocusedElements } from "../utils/useIsFocused";
import { useSaveArticle } from ".";
import { MenuTransition } from "../elements/transitions/MenuTransition";

export const ArticleContent = ({
  id,
  folder,
  selected,
  label,
  children,
  isModified: initialIsModified,
  variant,
  version,
}: {
  id: string;
  folder: string | undefined;
  selected: boolean;
  label: string;
  children: React.ReactNode;
  isModified: boolean;
  variant?: string;
  version: number | undefined;
}) => {
  const [dialogIsOpen, setDialogIsOpen] = React.useState<null | string>(null);

  const [isModified, setIsModified] = React.useState(initialIsModified);

  const collab = useCollab();

  React.useEffect(() => {
    return collab.registerMutationListener((doc) => {
      if (doc === id) {
        setIsModified(true);
      }
    });
  }, []);

  React.useEffect(() => {
    setIsModified(initialIsModified);
  }, [version, initialIsModified]);

  return (
    <FocusOrchestrator>
      <Content
        variant={variant}
        selected={selected}
        header={
          <Content.Header>
            <div
              className={cl(
                "flex-center h-full pl-2.5 font-medium",
                variant === "template" && "text-teal-500"
              )}
            >
              {label}
              {isModified && (
                <div className="w-2 h-2 bg-amber-500 rounded-md ml-2" />
              )}
              {variant === "template" && (
                <span className="text-sm font-light mt-1 ml-4 text-gray-400">
                  <DocumentDuplicateIcon className="w-4 h-4" />
                </span>
              )}
            </div>
          </Content.Header>
        }
        buttons={
          <Content.Buttons>
            {/*<GroupButton />*/}
            {folder && (
              <SaveButton id={id} folder={folder} isModified={isModified} />
            )}
            <NoList>
              <DragButton />
            </NoList>
          </Content.Buttons>
        }
      >
        {children}
      </Content>
    </FocusOrchestrator>
  );
};

function SaveButton({
  id,
  folder,
  isModified,
}: {
  id: string;
  folder: string;
  isModified: boolean;
}) {
  const collab = useCollab();
  const [isLoading, setIsLoading] = React.useState(false);
  const saveArticle = useSaveArticle(folder);
  return (
    <div className="relative z-0">
      {isLoading && (
        <div className="absolute inset-0 bg-amber-500 animate-ping rounded-lg opacity-50 pointer-events-none" />
      )}
      <Content.Button
        icon={ArrowUpTrayIcon}
        onClick={async () => {
          if (isLoading) return;
          setIsLoading(true);
          await collab.sync(true);
          const result = await saveArticle(id);
          setIsLoading(false);
          console.log("SAVED", result);
        }}
        className={isModified ? "text-amber-300" : "text-green-300"}
      />
    </div>
  );
}

function GroupButton() {
  const getElements = useFocusedElements();

  const { current } = useSegment();
  const path = getPathFromSegment(current);

  const [, articleId] = path.split("/").slice(-1)[0].split("-");

  const id = minimizeId(articleId);

  const { push } = useCollab().mutate<DocumentConfigOp>(id, id);

  const onClick = () => {
    const elements = getElements();

    const ops: DocumentConfigOp["ops"] = elements.map((el) => ({
      index: 0,
      insert: [],
      remove: 1,
    }));

    ops.push({
      index: 0,
      insert: elements,
      remove: 0,
    });

    push({
      target: targetTools.stringify({
        field: "any",
        operation: "computation",
        location: "",
      }),
      ops,
    });
  };

  return (
    <Content.Button
      icon={ViewColumnsIcon}
      onClick={onClick}
      onMouseDown={(ev) => {
        ev.stopPropagation();
      }}
    />
  );
}

function DragButton() {
  const label = "Default";

  const { ref, dragHandleProps, state } = useDragItem({
    id: `ny-blok-2-${label}`,
    type: "fields",
    item: {
      type: "default",
      __new__: true,
    },
    mode: "move",
  });

  return (
    <div className="relative z-10">
      <Menu>
        {({ open }) => (
          <>
            <Menu.Button
              as={Content.Button}
              {...dragHandleProps}
              icon={PlusIcon}
              active={open}
            />
            <MenuTransition show={open} className="absolute right-0">
              <Menu.Items
                static
                className="bg-white dark:bg-gray-800 mt-1 rounded shadow flex flex-col outline-none overflow-hidden"
              >
                <DragItem
                  label={"Felt"}
                  item={{
                    type: "default",
                    __new__: true,
                  }}
                />
                <DragItem
                  label={"Komponent"}
                  item={{
                    type: "component",
                    __new__: true,
                  }}
                />
                <DragItem
                  label={"Artikel"}
                  item={{
                    type: "article",
                    __new__: true,
                  }}
                />
                <DragItem
                  label={"Liste"}
                  item={{
                    type: "list",
                    __new__: true,
                  }}
                />
                <DragItem
                  label={"Overskrift"}
                  item={{
                    text: "Overskrift",
                    level: 1,
                  }}
                />
                <DragItem
                  label={"Label"}
                  item={{
                    template: getDocumentId(LABEL_ID),
                  }}
                />
                <DragItem
                  label={"Slug"}
                  item={{
                    template: getDocumentId(SLUG_ID),
                  }}
                />
                <DragItem
                  label={"Side"}
                  item={{
                    template: getDocumentId(PAGE_ID),
                  }}
                />
                <DragItem
                  label={"Layout"}
                  item={{
                    template: getDocumentId(LAYOUT_ID),
                  }}
                />
                <DragItem
                  label={"Omdirigering"}
                  item={{
                    template: getDocumentId(REDIRECT_ID),
                  }}
                />
                <DragItem
                  label={"Offentlig"}
                  item={{
                    template: getDocumentId(PUBLISHED_ID),
                  }}
                />
                <DragItem
                  label={"Udgivelsesdato"}
                  item={{
                    template: getDocumentId(RELEASED_ID),
                  }}
                />
                <DragItem
                  label={"Bruger"}
                  item={{
                    template: getDocumentId(USER_ID),
                  }}
                />
              </Menu.Items>
            </MenuTransition>
          </>
        )}
      </Menu>
    </div>
  );
}

function DragItem({ item, label }: { label: string; item: any }) {
  const { ref, dragHandleProps, state } = useDragItem({
    id: `ny-blok-2-${label}`,
    type: "fields",
    item,
    mode: "move",
  });

  return (
    <Menu.Item>
      {({ active }) => (
        <button
          ref={ref as React.MutableRefObject<HTMLButtonElement | null>}
          {...dragHandleProps}
          className={cl(
            "p-3 text-sm text-left outline-none text-gray-600 dark:text-gray-100 hover:bg-teal-100 hover:text-teal-600 dark:hover:bg-teal-600 dark:hover:text-teal-100 transition-colors",
            active ? "bg-teal-100 text-teal-600" : ""
          )}
        >
          {label}
        </button>
      )}
    </Menu.Item>
  );
}
