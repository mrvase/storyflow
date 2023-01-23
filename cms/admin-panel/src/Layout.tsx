import { Link, useLocation } from "@storyflow/router";
import { SWRClient } from "./client";

export function Layout() {
  const { pathname } = useLocation();

  const { data: user } = SWRClient.articles.getArticle.useQuery(pathname);

  return (
    <div className="bg-gray-900">
      {user} <Link to={`${pathname}/test`}>videre</Link>
    </div>
  );
}
