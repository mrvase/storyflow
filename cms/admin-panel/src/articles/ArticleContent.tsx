import cl from "clsx";
import { NoList, useDragItem } from "@storyflow/dnd";
import { Transition } from "@headlessui/react";
import {
  AdjustmentsHorizontalIcon,
  ArrowUpTrayIcon,
  CogIcon,
  DocumentDuplicateIcon,
} from "@heroicons/react/24/outline";
import React from "react";
import Content from "../layout/components/Content";
import { useCollab } from "../state/collaboration";
import { FocusOrchestrator } from "../utils/useIsFocused";
import { useSaveArticle } from ".";
import { useLocalStorage } from "../state/useLocalStorage";
import { DocumentId } from "@storyflow/backend/types";
import { computeFieldId, createFieldId } from "@storyflow/backend/ids";
import { FIELDS } from "@storyflow/backend/fields";

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
  id: DocumentId;
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

  const [isEditing, setIsEditing] = useLocalStorage<boolean>(
    "editing-articles",
    false
  );

  return (
    <FocusOrchestrator>
      <Content
        variant={variant}
        selected={selected}
        header={
          <Content.Header>
            <div
              className={cl(
                "flex-center h-full font-medium",
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
        toolbar={
          isEditing ? (
            <Content.Toolbar>
              <NoList>
                <DragButton
                  label={"Nyt felt"}
                  item={() => ({
                    id: createFieldId(id),
                    label: "",
                    type: "default",
                  })}
                />
                <DragButton
                  label={"Label"}
                  item={() => ({
                    ...FIELDS.label,
                    id: computeFieldId(id, FIELDS.label.id),
                  })}
                />
                <DragButton
                  label={"Slug"}
                  item={() => ({
                    ...FIELDS.slug,
                    id: computeFieldId(id, FIELDS.slug.id),
                  })}
                />
              </NoList>
            </Content.Toolbar>
          ) : undefined
        }
        buttons={
          <Content.Buttons>
            {/*<GroupButton />*/}
            <Content.Button
              icon={AdjustmentsHorizontalIcon}
              onClick={() => setIsEditing((ps) => !ps)}
            />
            {folder && (
              <SaveButton id={id} folder={folder} isModified={isModified} />
            )}
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
        }}
        className={isModified ? "text-amber-300" : "text-green-300"}
      />
    </div>
  );
}

function DragButton({ item, label }: { label: string; item: any }) {
  const { ref, dragHandleProps, state } = useDragItem({
    id: `ny-blok-2-${label}`,
    type: "fields",
    item,
    mode: "move",
  });

  return (
    <button
      ref={ref as React.MutableRefObject<HTMLButtonElement | null>}
      {...dragHandleProps}
      className="text-xs font-light py-1 px-2 rounded bg-white/10 hover:bg-white/20 text-white/80 transition-colors"
    >
      {label}
    </button>
  );
}
