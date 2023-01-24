import cl from "clsx";
import {
  ComputerDesktopIcon,
  DocumentIcon,
  FolderIcon,
  HomeIcon,
  Squares2X2Icon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import useLocationLabel from "../useLocationLabel";
import Loader from "../../elements/Loader";
import { useTabUrl } from "../utils";
import { Tab } from "../types";

export default function TabButton({
  isCurrent,
  tab,
}: {
  isCurrent: boolean;
  tab: Tab;
}) {
  const { label, type } = useLocationLabel(tab.segment);

  const getTitle = () => {
    if (type === "folder") {
      return (
        <>
          <FolderIcon className="w-4 h-4 mr-2" /> {label}
        </>
      );
    }
    if (type === "app") {
      return (
        <>
          <ComputerDesktopIcon className="w-4 h-4 mr-2" />
          {label}
        </>
      );
    }
    if (type === "component") {
      return (
        <>
          <Squares2X2Icon className="w-4 h-4 mr-2" /> {label}
        </>
      );
    }
    if (type === "data") {
      return (
        <>
          <DocumentIcon className="w-4 h-4 mr-2" />
          {label}
        </>
      );
    }
    if (type === "home") {
      return (
        <>
          <HomeIcon className="w-4 h-4" />
        </>
      );
    }
    return "[Tom]";
  };

  let [, navigateTab] = useTabUrl();

  return (
    <button
      type="button"
      className={cl(
        "h-7 flex items-center bg-white dark:bg-gray-800",
        !isCurrent && "opacity-50",
        "relative text-xs leading-0 rounded-md py-1.5 px-12"
      )}
      style={{
        order: tab.order,
      }}
    >
      {type === "loading" ? <Loader /> : getTitle()}
      <div
        className="absolute right-0 top-0 w-7 h-7 flex justify-center items-center opacity-30 hover:opacity-100 transition-opacity"
        onClick={(ev) => {
          ev.stopPropagation();
          navigateTab(tab.segment, { close: true });
        }}
      >
        <XMarkIcon className="w-4 h-4" />
      </div>
    </button>
  );
}
