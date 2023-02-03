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

  const currentName = decodeURIComponent(
    (router.query.story as string[] | undefined)?.[0] ?? ""
  );

  const current = stories.stories.find((el) => el.name === currentName);

  const head = iframe?.contentDocument?.head;
  const body = iframe?.contentDocument?.body;

  return (
    <div className="bg-gray-100 fixed inset-0 flex flex-col">
      <div className="flex gap-2 w-full grow-0 shrink-0 overflow-x-auto p-4">
        {stories.stories.map((story) => (
          <Link
            key={story.name}
            href={`/viewer/${encodeURIComponent(story.name)}`}
            className="bg-white px-3 py-1 shadow-sm rounded text-sm text-gray-700 whitespace-nowrap no-scrollbar"
          >
            {story.label}
          </Link>
        ))}
      </div>
      <iframe ref={iframeRef} className="w-full h-full bg-white" />
      {head ? ReactDOM.createPortal(headElements, head) : null}
      {body
        ? ReactDOM.createPortal(
            <RenderPage data={current?.page ?? []} key={currentName} />,
            body
          )
        : null}
    </div>
  );
}
