import cl from "clsx";
import { DropShadow, Sortable } from "@storyflow/dnd";
import FolderItem from "./Folder";
import { DBFolder, FolderChild } from "@storyflow/backend/types";
import { useFolderMutation } from "..";
import { DragResultAction } from "@storyflow/dnd/types";

type FolderNode = {
  id: string;
  index: string;
  next: FolderNode | null;
  tombstone?: true;
};

const getFolderChildren = (children: FolderChild[]) => {
  const map = new Map<string, FolderNode>([
    ["start", { id: "start", index: "start", next: null }],
  ]);

  children.forEach((child) => {
    if ("id" in child) {
      const prevNode = map.get(child.after ?? "start")!;
      const nextNode = prevNode.next;
      const node = {
        id: child.id,
        index: child.index,
        next: nextNode,
      };
      prevNode.next = node;
      map.set(child.index, node);
    } else if ("remove" in child) {
      const node = map.get(child.remove)!;
      node.tombstone = true;
    }
  });

  const ids = [] as { id: string; index: string }[];

  const recursive = (el: FolderNode) => {
    if (!el.tombstone) {
      ids.push({ id: el.id, index: el.index });
    }
    if (el.next) {
      recursive(el.next);
    }
  };

  const first = map.get("start")!.next;

  if (first) {
    recursive(first);
  }

  return ids;
};

export default function FolderGrid({
  parent,
  folders,
  disabled,
  cols,
}: {
  parent: DBFolder;
  folders: DBFolder[];
  disabled: boolean;
  cols: string;
}) {
  const children = getFolderChildren(parent?.children ?? []);

  const childrenAsFolders = children.map(
    ({ id }) => (folders ?? []).find((folder) => folder.id === id)!
  );

  const mutate = useFolderMutation(parent.id);

  const onChange = (actions: DragResultAction[]) => {
    let deleted: number | null = null;
    const result = actions.map((action) => {
      if (action.type === "add") {
        const item = action.item;
        let i = action.index - 1;
        i = deleted !== null && deleted <= i ? i + 1 : i;
        const index = children[i]?.index ?? null;
        return {
          id: item.id,
          index: Math.random().toString(36).slice(2, 6),
          after: index,
        };
      }
      deleted = action.index;
      const index = children[action.index]!.index;
      return {
        remove: index,
      };
    });
    console.log("ACTIONS", actions, result);
    mutate({
      type: "reorder",
      children: result,
    });
  };

  return (
    <Sortable
      type="folders"
      id={parent.id ?? "no-folder"}
      canReceive={{
        link: () => "ignore",
        move: ({ type }) => {
          console.log("MOVING", type);
          return type === "folders" ? "accept" : "ignore";
        },
      }}
      disabled={disabled}
      onChange={onChange}
    >
      <div className={cl("flex flex-wrap gap-2")}>
        {childrenAsFolders.map((folder, index) => (
          <FolderItem folder={folder} index={index} key={folder.id} />
        ))}
        <DropShadow>
          {(item) => {
            console.log("RENDERING", item);
            return <FolderItem index={folders.length} folder={item} />;
          }}
        </DropShadow>
      </div>
    </Sortable>
  );
}