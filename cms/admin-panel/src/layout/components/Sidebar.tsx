import React from "react";
import { MinusIcon } from "@heroicons/react/24/outline";
import cl from "clsx";
import { useLocalStorage } from "../../state/useLocalStorage";

export default function Sidebar() {
  const [isOpen, setIsOpen] = useLocalStorage<boolean>(
    "sidebar-is-open",
    false
  );

  const toggleOpen = () => setIsOpen((ps) => !ps);

  return (
    <>
      <div
        className={cl(
          "relative h-screen shrink-0 grow-0 overflow-hidden transition-[width] ease-out",
          isOpen ? "w-56" : "w-0"
        )}
      >
        <div className="absolute right-0 h-screen w-72">
          <div className="p-3 flex">
            <button
              className="ml-auto text-sm h-7 px-2 flex items-center rounded-md bg-gray-500 bg-opacity-90 text-gray-300 hover:text-white hover:bg-opacity-100 transition-colors"
              onClick={toggleOpen}
            >
              <MinusIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
