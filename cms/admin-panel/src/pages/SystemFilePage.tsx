import React from "react";
import cl from "clsx";
import Content from "./Content";
import {
  EllipsisHorizontalIcon,
  FolderIcon,
  PencilIcon,
  PencilSquareIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { FileContainer } from "../elements/FileContainer";
import { useOrganization } from "../clients/auth";
import { Menu } from "../elements/Menu";
import Dialog from "../elements/Dialog";
import Loader from "../elements/Loader";
import { useFiles } from "../data/files";
import { Link } from "@nanokit/router";
import { addFile } from "../custom-events";
import { InlineButton } from "../elements/InlineButton";

export function SystemFilePage({ params }: { params: Record<string, string> }) {
  const [files, { renameFile }] = useFiles();
  const slug = useOrganization()!.slug;

  const page = parseInt((params?.page as string | undefined) ?? "1", 10) - 1;

  const [dialog, setAction] = React.useState<{
    action: "delete" | "rename";
    file: string;
  } | null>(null);

  const label = React.useMemo(
    () =>
      dialog ? files.find((el) => el.name === dialog.file)!.label : undefined,
    [dialog?.file, files]
  );

  const paginatedFiles = React.useMemo(
    () => files.slice(page * 12, page * 12 + 12),
    [files, page]
  );

  const maxPage = Math.ceil(files.length / 12);

  return (
    <>
      <Dialog
        isOpen={Boolean(dialog)}
        close={() => setAction(null)}
        title={dialog?.action === "delete" ? "Slet fil" : "Ændr filnavn"}
      >
        {dialog && (
          <div className="w-1/2 mx-auto">
            <FileContainer
              src={`https://cdn.storyflow.dk/${slug}/${dialog.file}`}
              label={label!}
            />
          </div>
        )}
        {dialog?.action === "delete" && <div></div>}
        {dialog?.action === "rename" && (
          <form
            onSubmit={async (ev) => {
              ev.preventDefault();
              const data = new FormData(ev.currentTarget);
              const newFile = {
                name: dialog.file,
                label: data.get("label") as string,
              };
              await renameFile(newFile);
              setAction(null);
            }}
            className="mt-5 flex flex-col"
          >
            <div className="text-sm font-medium mb-1">Omdøb</div>
            <input
              type="text"
              defaultValue={label!}
              name="label"
              className="ring-button bg-transparent rounded h-10 flex items-center px-2.5 outline-none w-full"
            />
            <button
              type="submit"
              className="mt-2 ml-auto h-10 px-5 bg-gray-700 hover:bg-gray-600 rounded font-medium text-sm transition-colors"
            >
              {renameFile.isMutating ? <Loader /> : "Navngiv"}
            </button>
          </form>
        )}
      </Dialog>
      <Content icon={FolderIcon} header="Alle filer">
        <div className="p-5 flex-center">
          {page > 0 && <Link to={`/~/files/${page}`}>&lt;</Link>}
          <div className="mx-5">
            Side {page + 1} af {maxPage}
          </div>
          {page < maxPage && <Link to={`/~/files/${page + 2}`}>&gt;</Link>}
        </div>
        <div className="px-5 gap-5 grid grid-cols-1 @sm:grid-cols-2 @xl:grid-cols-3 @4xl:grid-cols-4">
          {paginatedFiles.map((file) => (
            <div key={file.name} className="group relative">
              <div className="absolute -top-2.5 -right-2.5">
                <Menu
                  as={Button}
                  icon={EllipsisHorizontalIcon}
                  align="right"
                  small
                >
                  <Menu.Item
                    label="Ændr navn..."
                    icon={PencilSquareIcon}
                    onClick={() => {
                      setAction({ action: "rename", file: file.name });
                    }}
                  />
                  <Menu.Item
                    label="Slet fil..."
                    icon={TrashIcon}
                    onClick={() => {
                      setAction({ action: "delete", file: file.name });
                    }}
                  />
                </Menu>
              </div>
              <FileContainer
                src={`https://cdn.storyflow.dk/${slug}/${file.name}`}
                label={file.label}
                onMouseDown={(ev) => {
                  ev.preventDefault();
                  addFile.dispatch(file.name);
                }}
              />
            </div>
          ))}
        </div>
      </Content>
    </>
  );
}

const Button = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button"> & {
    icon?: React.FC<{ className?: string }>;
    active?: boolean;
    color?: "gray" | "teal";
  }
>((props, ref) => {
  return (
    <InlineButton
      ref={ref as any}
      {...props}
      className={cl(
        !props.active && "opacity-0 group-hover:opacity-100",
        props.className
      )}
    />
  );
});
