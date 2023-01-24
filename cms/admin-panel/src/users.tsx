import { useLocation } from "@storyflow/router";
import { trimLeadingSlash } from "./utils/trimSlashes";

export function useOrganisationSlug() {
  const { pathname } = useLocation();

  const slug = trimLeadingSlash(pathname).split("/")[0];

  if (slug.startsWith("~")) return "";

  return slug;
}
