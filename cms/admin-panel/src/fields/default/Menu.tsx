import React from "react";
import cl from "clsx";
import {
  ArrowDownOnSquareIcon,
  ArrowLeftIcon,
  CalendarIcon,
  CheckCircleIcon,
  DocumentIcon,
  LinkIcon,
  PhotoIcon,
  PlusIcon,
  Squares2X2Icon,
  SwatchIcon,
} from "@heroicons/react/24/outline";
import { useClientConfig } from "../../client-config";
import {
  addFetcher,
  addLayoutElement,
  addNestedDocument,
} from "../../custom-events";
import { MenuTransition } from "../../elements/transitions/MenuTransition";
import useIsFocused from "../../utils/useIsFocused";

export function Menu({
  isEmpty,
  hasDocument,
  blockIsFocused,
  y,
  mathMode,
  setMathMode,
}: {
  isEmpty: boolean;
  hasDocument: boolean;
  blockIsFocused: boolean;
  y: number;
  mathMode: boolean;
  setMathMode: (callback: (ps: boolean) => boolean) => void;
}) {
  const canAddDocument = isEmpty || hasDocument;
  const canAddElement = !hasDocument;
  const canAddRichText = !hasDocument && !blockIsFocused;

  const openElementWindow = canAddElement && !canAddDocument && !canAddRichText;

  const [menuId, setMenuId] = React.useState<
    "select" | "template" | "element" | null
  >(null);

  const { isFocused, handlers } = useIsFocused();

  React.useEffect(() => {
    if (!isFocused) {
      setMenuId(null);
    }
  }, [isFocused]);

  const { libraries } = useClientConfig();

  return (
    <div
      className="absolute z-10 top-0 right-0 w-8 h-8 -m-1 mx-3"
      style={{ transform: `translateY(${y}px)` }}
      {...handlers}
      onMouseDown={(ev) => {
        ev.preventDefault();
        handlers.onMouseDown(ev);
      }}
    >
      <button
        tabIndex={-1}
        type="button"
        className="opacity-50 hover:opacity-100 p-2"
        onMouseDown={(ev: any) => {
          ev.preventDefault();
          //addLayoutElement.dispatch();
        }}
        onClick={() => setMenuId(openElementWindow ? "element" : "select")}
      >
        <PlusIcon className="w-4 h-4" />
      </button>
      <MenuTransition show={menuId !== null} className="absolute right-0">
        <div className="relative text-xs w-60 h-48">
          <Window
            show={menuId !== null}
            background={menuId !== "select"}
            className="flex flex-col gap-2"
          >
            <div>
              {canAddElement && (
                <Button
                  className="w-full"
                  onClick={() => {
                    setMenuId("element");
                  }}
                >
                  <Squares2X2Icon className="w-4 h-4 ml-1 mr-2" /> Element
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              {canAddDocument && (
                <Button
                  className="grow shrink basis-0"
                  onClick={() => {
                    addNestedDocument.dispatch();
                  }}
                >
                  <DocumentIcon className="w-4 h-4 ml-1 mr-2" /> Dokument
                </Button>
              )}
              {canAddDocument && (
                <Button
                  className="grow shrink basis-0"
                  onClick={() => {
                    addFetcher.dispatch();
                  }}
                >
                  <ArrowDownOnSquareIcon className="w-4 h-4 ml-1 mr-2" />{" "}
                  Fetcher
                </Button>
              )}
            </div>
            {canAddRichText && (
              <div className="flex gap-2">
                {[
                  { label: "Farve", Icon: SwatchIcon },
                  { label: "Billede", Icon: PhotoIcon },
                  { label: "Dato", Icon: CalendarIcon },
                  { label: "Boolean", Icon: CheckCircleIcon },
                  {
                    label: "Link",
                    Icon: LinkIcon,
                    onClick() {},
                  },
                ].map(({ label, Icon, onClick }) => (
                  <Button
                    key={label}
                    className="grow shrink basis-0 justify-center"
                    onClick={onClick}
                  >
                    <Icon className="w-4 h-4" />
                  </Button>
                ))}
              </div>
            )}
            {!hasDocument && (
              <Button
                className="justify-center"
                onClick={() => {
                  setMathMode((ps) => !ps);
                  setMenuId(null);
                }}
              >
                Skift til
                <strong className="ml-1">
                  {mathMode ? "tekst" : "matematik"}
                </strong>
              </Button>
            )}
          </Window>
          <Window show={menuId === "element"}>
            <div className="flex items-center gap-2">
              <Button onClick={() => setMenuId("select")}>
                <ArrowLeftIcon className="w-4 h-4" />
              </Button>
              Vælg element
            </div>
            <div className="overflow-y-auto mt-2 no-scrollbar h-[8.5rem]">
              <div className="flex flex-col gap-2">
                {libraries.map((library) => (
                  <React.Fragment key={library.name}>
                    {Object.values(library.components).map((comp) => (
                      <Button
                        key={library.name + comp.name}
                        onClick={(ev) => {
                          addLayoutElement.dispatch({
                            name: comp.name,
                            library: library.name,
                          });
                        }}
                      >
                        {comp.label}
                      </Button>
                    ))}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </Window>
          <Window show={menuId === "template"}>Vælg template</Window>
        </div>
      </MenuTransition>
    </div>
  );
}
function Window({
  show,
  background,
  children,
  className,
}: {
  show: boolean;
  background?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cl(
        "bg-gray-800 p-2 absolute inset-x-0 top-0 shadow-lg rounded overflow-hidden",
        show
          ? "opacity-100 translate-x-0"
          : "opacity-0 translate-x-5 pointer-events-none",
        "transition-[opacity,transform] ease-out",
        className
      )}
    >
      {children}
    </div>
  );
}
function Button({
  children,
  className,
  onClick,
}: {
  children?: React.ReactNode;
  className?: string;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
}) {
  return (
    <button
      type="button"
      className={cl(
        "p-2 bg-gray-700/50 flex items-center rounded text-gray-600 dark:text-gray-100 hover:bg-teal-100 hover:text-teal-600 dark:hover:bg-teal-600 dark:hover:text-teal-100 transition-colors",
        className
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
