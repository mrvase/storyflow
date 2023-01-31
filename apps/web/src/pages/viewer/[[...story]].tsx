import "../../styles.css";
import { registerLibraries, RenderPage } from "@storyflow/react";
import Link from "next/link";
import { useRouter } from "next/router";
import { library, stories } from "../../components";

registerLibraries([library]);

export default function Page() {
  return <Stories />;
}

function Stories() {
  const router = useRouter();

  const currentName = decodeURIComponent(
    (router.query.story as string[] | undefined)?.[0] ?? ""
  );

  const current = stories.stories.find((el) => el.name === currentName);

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
      <div className="bg-white w-full grow overflow-auto">
        <div className="relative block" style={{ padding: "0.05px" }}>
          <RenderPage data={current?.page ?? []} key={currentName} />
        </div>
      </div>
    </div>
  );
}
