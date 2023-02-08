import { useLocation } from "@storyflow/router";
import { trimLeadingSlash } from "./utils/trimSlashes";

const DEFAULT_VERSION = 0;

export function useUrlInfo() {
  const { pathname } = useLocation();

  const slugs = trimLeadingSlash(pathname).split("/");

  const hasVersion = slugs[0].match(/v\d+/);

  const versionSlug = hasVersion ? slugs[0] : `v${DEFAULT_VERSION}`;
  const organization = hasVersion ? slugs[1] : slugs[0];

  const version = parseInt(versionSlug.replace("v", ""), 10);

  if (organization.startsWith("~")) {
    return {
      version,
      organization: "",
      urlInfoSegment: hasVersion ? `/${versionSlug}` : "/",
    };
  }

  const urlInfoSegment = hasVersion
    ? `/${versionSlug}/${organization}`
    : `/${organization}`;

  return { version, organization, urlInfoSegment };
}
