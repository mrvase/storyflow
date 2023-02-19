import "../../styles.css";
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

  const [headElements, setHeadElements] = React.useState<React.ReactElement[]>(
    []
  );

  React.useLayoutEffect(() => {
    if (iframe) {
      const head = iframe.contentDocument?.head;
      if (!head) return;
      const currentHead = document.head;
      const isElementNode = (el: Node): el is HTMLElement => {
        return el.nodeType === Node.ELEMENT_NODE;
      };
      const elements: React.ReactElement[] = [];
      currentHead.childNodes.forEach((el) => {
        if (isElementNode(el) && el.tagName === "LINK") {
          const props: any = {};
          for (let i = 0; i < el.attributes.length; i++) {
            const attribute = el.attributes[i];
            props[attribute.name] = attribute.value;
          }
          elements.push(React.createElement("link", props));
        }
      });
      setHeadElements(elements);
      /*
      head.textContent = "";
      elements.forEach((el) => head.appendChild(el));
      */
    }
  }, [iframe, stories]);

  const currentKey = decodeURIComponent(
    (router.query.story as string[] | undefined)?.[0] ?? ""
  );

  const currentIndex = parseInt(
    (router.query.story as string[] | undefined)?.[1] ?? "0",
    10
  );

  const currentComponent = stories.components[currentKey];
  const current = currentComponent?.[currentIndex];

  const head = iframe?.contentDocument?.head;
  const body = iframe?.contentDocument?.body;

  return (
    <div className="bg-gray-100 fixed inset-0 flex">
      <div className="flex p-1 gap-1 flex-col w-52 grow-0 shrink-0 overflow-x-auto  bg-gray-900">
        {Object.entries(stories.components).map(([key, stories]) => (
          <div className="w-full flex flex-col divide-y divide-gray-600 rounded overflow-hidden bg-gray-800">
            <Link
              key={key}
              href={`/viewer/${encodeURIComponent(key)}`}
              className={[
                "px-3 py-2 shadow-sm text-sm text-white whitespace-nowrap no-scrollbar flex justify-between",
                key === currentKey ? "text-white bg-gray-700" : "text-white/75",
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
      <iframe ref={iframeRef} className="w-full h-full bg-white" />
      {head ? ReactDOM.createPortal(headElements, head) : null}
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
