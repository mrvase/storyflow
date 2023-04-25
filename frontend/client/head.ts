import { Metadata } from "./types";

type Props = Record<string, string>;
type Tag = [string, Props, string?];

export function createHeadTags({
  title,
  description,
  canonical,
  twitter,
  facebook,
  openGraph,
  alternates,
  robots = {},
}: Metadata) {
  const tags: Map<string, Tag> = new Map();

  const addTag = (
    type: "meta" | "link" | "title",
    props: Record<string, string>
  ) => {
    // All SEO tags either have unique html tag name or unique key
    tags.set(`${type}/${props?.key ?? ""}`, [type, props]);
  };

  /* SHORTCUTS */

  const addMetaWithName = (key: string, content: string) => {
    addTag("meta", { key, name: key, content });
  };
  const addMetaWithProp = (key: string, content: string) => {
    addTag("meta", { key, property: key, content });
  };
  const addOGProp = (key: string, content: string) => {
    addMetaWithProp(`og:${key}`, content);
  };
  const addNestedOGProp = (mediaType: string, index: number) => {
    return (key: string | undefined, content: string) => {
      const string = ["og", mediaType].concat(key ?? []).join(":");
      const indexString = `0${index}`.slice(-2);
      addTag("meta", {
        key: `${string}${indexString}`,
        property: string,
        content,
      });
    };
  };
  const addMedium =
    (type: "image" | "video") => (medium: any, index: number) => {
      const addMediumProp = addNestedOGProp(type, index);
      addMediumProp(undefined, medium.url);
      if (medium.alt) addMediumProp("alt", medium.alt);
      if (medium.secureUrl) addMediumProp("secure_url", medium.secureUrl);
      if (medium.type) addMediumProp("type", medium.type);
      if (medium.width) addMediumProp("width", String(medium.width));
      if (medium.height) addMediumProp("height", String(medium.height));
    };

  /* BUILD TAGS */
  addMetaWithName(
    "robots",
    [
      robots.noindex ? "noindex" : "index",
      robots.nofollow ? "nofollow" : "follow",
      robots.nosnippet ? "nosnippet" : "",
      robots.noarchive ? "noarchive" : "",
      robots.noimageindex ? "noimageindex" : "",
      robots.notranslate ? "notranslate" : "",
    ]
      .filter(Boolean)
      .join(",")
  );
  if (title) {
    addTag("title", { children: title });
    addOGProp("title", title);
  }
  if (description) {
    addMetaWithName("description", description);
    addOGProp("description", description);
  }
  if (canonical) {
    addTag("link", { rel: "canonical", href: canonical, key: "canonical" });
  }
  if (twitter) {
    if (twitter.cardType) addMetaWithName("twitter:card", twitter.cardType);
    if (twitter.site) addMetaWithName("twitter:site", twitter.site);
    if (twitter.handle) addMetaWithName("twitter:creator", twitter.handle);
  }
  if (facebook) {
    if (facebook.appId) addMetaWithProp("fb:app_id", facebook.appId);
  }
  if (openGraph) {
    if (openGraph.url || canonical)
      addOGProp("url", (openGraph.url || canonical)!);
    if (openGraph.title) addOGProp("title", openGraph.title);
    if (openGraph.description) addOGProp("description", openGraph.description);
    if (openGraph.site_name) addOGProp("site_name", openGraph.site_name);

    if (openGraph.type) {
      // TODO
    }

    if (openGraph.images) {
      openGraph.images.forEach(addMedium("image"));
    }

    if (openGraph.videos) {
      openGraph.videos.forEach(addMedium("video"));
    }
  }

  if (alternates) {
    alternates.forEach(({ hrefLang, href }: any) => {
      addTag("link", {
        rel: "alternate",
        key: `languageAlternate-${hrefLang}`,
        hrefLang,
        href,
      });
    });
  }

  return Array.from(tags.values());
}
