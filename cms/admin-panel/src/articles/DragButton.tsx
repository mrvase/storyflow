import React from "react";
/*
import cl from "clsx";
import { useDragItem } from "@storyflow/dnd";
import { PlusIcon } from "@heroicons/react/24/outline";
import { Menu } from "@headlessui/react";
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
import { getDocumentId } from "@storyflow/backend/ids";
import { MenuTransition } from "../elements/transitions/MenuTransition";

export function DragButton() {
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
*/
