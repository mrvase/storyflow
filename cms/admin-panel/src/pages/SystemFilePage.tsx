import React from "react";
import cl from "clsx";
import Content from "./Content";
import {
  EllipsisHorizontalIcon,
  FolderIcon,
  PencilIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { FileContainer } from "../elements/FileContainer";
import { useOrganization } from "../clients/auth";
import { Menu } from "../elements/Menu";
import Dialog from "../elements/Dialog";
import { query } from "../clients/client";
import { useImmutableQuery } from "@nanorpc/client/swr";
import Loader from "../elements/Loader";
import { useFiles } from "../data/files";

export function SystemFilePage() {
  const [files, { renameFile }] = useFiles();
  const slug = useOrganization()!.slug;

  const [dialog, setAction] = React.useState<{
    action: "delete" | "rename";
    file: string;
  } | null>(null);

  const label = React.useMemo(
    () =>
      dialog ? files.find((el) => el.name === dialog.file)!.label : undefined,
    [dialog?.file, files]
  );

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
        <div className="px-5 gap-5 grid grid-cols-1 @sm:grid-cols-2 @xl:grid-cols-3 @4xl:grid-cols-4">
          {files.map((file) => (
            <div key={file.name} className="group relative">
              <div className="absolute -top-2.5 -right-2.5">
                <Menu
                  as={Button}
                  icon={EllipsisHorizontalIcon}
                  align="right"
                  small
                >
                  <Menu.Item
                    label="Ændr navn"
                    icon={PencilIcon}
                    onClick={() => {
                      setAction({ action: "rename", file: file.name });
                    }}
                  />
                  <Menu.Item
                    label="Slet fil"
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
    icon?: React.FC<{ className: string }>;
    active?: boolean;
    selected?: boolean;
  }
>(({ icon: Icon, active, selected, ...props }, ref) => {
  return (
    <button
      ref={ref}
      {...props}
      className={cl(
        "rounded-full w-5 h-5 bg-gray-850 ring-1 ring-gray-600 flex-center transition-opacity",
        active
          ? "opacity-100"
          : "opacity-0 group-hover:opacity-75 group-hover:hover:opacity-100"
      )}
    >
      {Icon && <Icon className="w-3 h-3" />}
    </button>
  );
});
