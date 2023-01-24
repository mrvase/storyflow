import { Link, useLocation } from "@storyflow/router";
import { useFolders } from "./folders/folders-context";

export function Layout() {
  const { pathname } = useLocation();

  const folders = useFolders();

  return (
    <div className="bg-gray-900">
      FOLDERS: {JSON.stringify(folders)}
      <Link to={`${pathname}/test`}>videre</Link>
    </div>
  );
}
