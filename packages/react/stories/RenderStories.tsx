import { Config, LibraryConfigRecord, LibraryRecord, Story } from "..";
import ReactDOM from "react-dom";
import React from "react";
import { getIdFromString } from "@storyflow/shared/getIdFromString";
import { RenderPage } from "../rsc";
import {
  CustomTransforms,
  PartialProps,
  PropConfigRecord,
  PropGroup,
} from "@storyflow/shared/types";
import { extendPath } from "../utils/extendPath";

let observer: MutationObserver | null = null;

function hasChildElement(needle: HTMLElement, parent: HTMLElement) {
  let result = false;
  for (let child = parent.firstChild; child; child = child.nextSibling) {
    if (child === needle) {
      // 1 == Element
      result = true;
      break;
    }
  }
  return result;
}

const observe = (node: HTMLIFrameElement) => {
  const head = node?.contentDocument?.head!;
  const current: HTMLElement[] = [];

  callback();

  function callback() {
    console.log("CALLBACK");
    const isElementNode = (el: Node): el is HTMLElement => {
      return el.nodeType === Node.ELEMENT_NODE;
    };

    const kept: any[] = [];
    document.head.childNodes.forEach((el) => {
      if (isElementNode(el) && ["LINK", "STYLE"].includes(el.tagName)) {
        if (!current.includes(el)) {
          head.appendChild(el.cloneNode(true));
          current.push(el);
        } else {
          kept.push(el);
        }
      }
    });
    current.forEach((el) => {
      if (!kept.includes(el) && hasChildElement(el, head)) {
        head.removeChild(el);
        current.splice(current.indexOf(el), 1);
      }
    });
  }

  if (observer) {
    observer.disconnect();
    observer = null;
  }

  observer = new MutationObserver(() => {
    callback();
  });

  observer.observe(document.head, {
    childList: true,
    subtree: true,
  });
};

export function RenderStories<T extends LibraryConfigRecord>({
  story,
  libraries,
  configs,
  transforms = {} as any,
  Link,
}: {
  story: string[] | undefined;
  configs: T;
  libraries: LibraryRecord<T>;
  Link: React.FC<{
    className?: string;
    href: any;
    children: React.ReactNode;
  }>;
} & ({} extends CustomTransforms
  ? { transforms?: CustomTransforms }
  : { transforms: CustomTransforms })) {
  const [iframe, setIframe] = React.useState<HTMLIFrameElement>();

  const iframeRef = React.useCallback((node: HTMLIFrameElement) => {
    if (node) {
      observe(node);
      setIframe(node);
    } else if (observer) {
      observer.disconnect();
      observer = null;
    }
  }, []);

  const currentLibraryName = decodeURIComponent(
    (story as string[] | undefined)?.[0] ?? ""
  );

  const currentComponentName = decodeURIComponent(
    (story as string[] | undefined)?.[1] ?? ""
  );

  const currentStoryName = decodeURIComponent(
    (story as string[] | undefined)?.[2] ?? ""
  );

  const getData = () => {
    const currentLibrary = configs[currentLibraryName];

    if (!currentLibrary) return;

    const currentComponent =
      currentLibrary?.configs?.[`${currentComponentName}Config`];

    if (!currentComponent || !("stories" in currentComponent)) return;

    const stories = currentComponent.stories;

    if (!stories || !(currentStoryName in stories)) return;

    const story = stories[currentStoryName as never] as Story;

    console.log("STORY", story);

    let index = 0;

    const createId = () => (index++).toString(16).padStart(24, "0");

    const record: Record<string, any> = {};

    const rootEntries = Object.values(configs)
      .map(({ configs }) => Object.entries(configs))
      .flat(1);

    const createElement = (
      componentName: string,
      config: Config,
      story: string
    ) => {
      const id = createId();

      const element = {
        id,
        element: `${currentLibraryName}:${componentName}`,
      };

      const handleProps = (
        props: PartialProps<PropConfigRecord>,
        group?: string
      ) => {
        Object.entries(props).map(([key, value]) => {
          const propConfig = group
            ? (config.props[group] as PropGroup).props[key]
            : config.props[key];

          if (propConfig.type === "group") {
            handleProps(value as any, key);
            return;
          }

          const optionEntries =
            "options" in propConfig &&
            propConfig.options &&
            !Array.isArray(propConfig.options)
              ? Object.entries(propConfig.options)
              : [];

          const propId = `${id.slice(12, 24)}${getIdFromString(
            extendPath(group ?? "", key, "#")
          )}`;

          if (!Array.isArray(value)) {
            record[propId] = [value];
            return [value];
          }

          record[propId] = value!.map((el) => {
            console.log("EL", el);
            if (el && typeof el === "object" && "stories" in el) {
              const name = [...rootEntries, ...optionEntries].find(
                ([, value]) => value === el
              )![0];
              const story = Object.keys(el.stories!)[0];
              console.log("NEXT STORY", story);
              return createElement(name.replace(/Config$/, ""), el, story);
            }
            return el;
          });
        });
      };

      handleProps(config.stories![story].props);

      return element;
    };

    const entry = [
      createElement(currentComponentName, currentComponent, currentStoryName),
    ] as any;

    const data = {
      entry,
      record,
    };

    console.log("DATA", data);

    return data;
  };

  const body = iframe?.contentDocument?.body;

  const [showMenu, setMenu] = React.useState(false);

  const toggleMenu = () => {
    setMenu((showMenu) => {
      localStorage.setItem("stories-show-menu", String(!showMenu));
      return !showMenu;
    });
  };

  React.useLayoutEffect(() => {
    setMenu(localStorage.getItem("stories-show-menu") !== "false");
    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === "k" && ev.metaKey) {
        toggleMenu();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    if (iframe) {
      iframe.contentDocument!.addEventListener("keydown", onKeyDown);
    }
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (iframe) {
        iframe.contentDocument!.removeEventListener("keydown", onKeyDown);
      }
    };
  }, [iframe]);

  return (
    <div className="bg-gray-100 fixed inset-0 flex">
      {showMenu && (
        <div className="flex p-1 gap-1 flex-col w-52 grow-0 shrink-0 overflow-x-auto bg-gray-900 text-white">
          {Object.entries(configs).map(([libraryName, { configs }]) => (
            <React.Fragment key={libraryName}>
              <div>{libraryName}</div>
              {Object.entries(configs).map(([componentName, config], index) =>
                !("stories" in config) ? null : (
                  <div
                    key={componentName}
                    className="w-full flex flex-col divide-y divide-gray-600 rounded overflow-hidden bg-gray-800"
                  >
                    <Link
                      href={`/stories?l=${encodeURIComponent(
                        libraryName
                      )}&c=${encodeURIComponent(
                        componentName.replace(/Config$/, "")
                      )}`}
                      className={[
                        "px-3 py-2 shadow-sm text-sm text-white whitespace-nowrap no-scrollbar flex justify-between",
                        componentName.replace(/Config$/, "") ===
                        currentComponentName
                          ? "text-white bg-gray-700"
                          : "text-white/75",
                      ].join(" ")}
                    >
                      {componentName.replace(/Config$/, "")}{" "}
                      <span>
                        {Object.keys(config.stories ?? {}).length > 1
                          ? `${Object.keys(config.stories ?? {}).length}`
                          : null}
                      </span>
                    </Link>
                    {Object.keys(config.stories ?? {}).map((storyName) => (
                      <Link
                        key={storyName}
                        href={`/stories?l=${encodeURIComponent(
                          libraryName
                        )}&c=${encodeURIComponent(
                          componentName.replace(/Config$/, "")
                        )}&s=${encodeURIComponent(storyName)}`}
                        className={[
                          "px-3 py-2 shadow-sm text-xs text-white whitespace-nowrap no-scrollbar",
                          (storyName || "default") ===
                          (currentStoryName || "default")
                            ? "bg-gray-700"
                            : "",
                          componentName.replace(/Config$/, "") ===
                          currentComponentName
                            ? "flex"
                            : "hidden",
                        ].join(" ")}
                      >
                        {storyName || "Standard"}
                      </Link>
                    ))}
                  </div>
                )
              )}
            </React.Fragment>
          ))}
        </div>
      )}
      <iframe ref={iframeRef} className="w-full h-full bg-white" />
      {body
        ? ReactDOM.createPortal(
            <RenderPage
              data={getData()}
              key={(story ?? []).join("/")}
              configs={configs}
              libraries={libraries}
              transforms={transforms}
            />,
            body
          )
        : null}
    </div>
  );
}
