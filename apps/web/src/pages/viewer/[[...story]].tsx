import { registerLibraries, RenderPage } from "@storyflow/react";
import Link from "next/link";
import { useRouter } from "next/router";
import { library, stories } from "../../components";
import ReactDOM from "react-dom";
import React from "react";

registerLibraries([library]);

export default function Page() {
  return <Stories />;
}

function Stories() {
  const router = useRouter();

  const [iframe, setIframe] = React.useState<HTMLIFrameElement>();

  const iframeRef = React.useCallback((node: HTMLIFrameElement) => {
    if (node) {
      setIframe(node);
    }
  }, []);

  const currentKey = decodeURIComponent(
    (router.query.story as string[] | undefined)?.[0] ?? ""
  );

  const currentIndex = parseInt(
    (router.query.story as string[] | undefined)?.[1] ?? "0",
    10
  );

  const currentComponent = stories.components[currentKey];
  const current = currentComponent?.[currentIndex];
  const body = iframe?.contentDocument?.body;

  const [showMenu, setMenu] = React.useState(false);

  const toggleMenu = () => {
    setMenu((showMenu) => {
      localStorage.setItem("viewer-show-menu", String(!showMenu));
      return !showMenu;
    });
  };

  React.useLayoutEffect(() => {
    setMenu(localStorage.getItem("viewer-show-menu") !== "false");
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
        <div className="flex p-1 gap-1 flex-col w-52 grow-0 shrink-0 overflow-x-auto  bg-gray-900">
          {Object.entries(stories.components).map(([key, stories]) => (
            <div className="w-full flex flex-col divide-y divide-gray-600 rounded overflow-hidden bg-gray-800">
              <Link
                key={key}
                href={`/viewer/${encodeURIComponent(key)}`}
                className={[
                  "px-3 py-2 shadow-sm text-sm text-white whitespace-nowrap no-scrollbar flex justify-between",
                  key === currentKey
                    ? "text-white bg-gray-700"
                    : "text-white/75",
                ].join(" ")}
              >
                {key}{" "}
                <span>{stories.length > 1 ? `${stories.length}` : null}</span>
              </Link>
              {stories.map((story, index) => (
                <Link
                  key={story.name}
                  href={`/viewer/${encodeURIComponent(key)}/${index}`}
                  className={[
                    "px-3 py-2 shadow-sm text-xs text-white whitespace-nowrap no-scrollbar",
                    story === current ? "bg-gray-700" : "",
                    key === currentKey ? "flex" : "hidden",
                  ].join(" ")}
                >
                  {story.label}
                </Link>
              ))}
            </div>
          ))}
        </div>
      )}
      <iframe ref={iframeRef} className="w-full h-full bg-white" />
      <IframeHead iframe={iframe} />
      {body
        ? ReactDOM.createPortal(
            <RenderPage
              data={current?.page ?? []}
              key={`${currentKey}/${currentIndex}`}
            />,
            body
          )
        : null}
    </div>
  );
}

function IframeHead({ iframe }: { iframe: HTMLIFrameElement | undefined }) {
  // const [headElements, setHeadElements] = React.useState<React.ReactElement[]>([]);
  const head = iframe?.contentDocument?.head;

  React.useInsertionEffect(() => {
    if (iframe) {
      if (!head) return;

      const callback = () => {
        head.textContent = "";
        const isElementNode = (el: Node): el is HTMLElement => {
          return el.nodeType === Node.ELEMENT_NODE;
        };
        const elements: React.ReactElement[] = [];
        let i = 0;
        document.head.childNodes.forEach((el) => {
          if (isElementNode(el) && ["LINK", "STYLE"].includes(el.tagName)) {
            const props: any = {
              key: i++,
            };
            for (let i = 0; i < el.attributes.length; i++) {
              const attribute = el.attributes[i];
              props[attribute.name] = attribute.value;
            }
            head.appendChild(el.cloneNode(true));
            // elements.push(React.createElement("link", props));
          }
        });
        // setHeadElements(elements);
      };

      const observer = new MutationObserver(() => {
        callback();
      });

      observer.observe(document.head, {
        childList: true,
        subtree: true,
      });

      callback();
      return () => {
        observer.disconnect();
      };
    }
  }, [iframe, stories]);

  return null;
  // return head ? ReactDOM.createPortal(<>{headElements}</>, head) : null;
}
