import { Library } from "@storyflow/shared/types";
import { cms } from "./CMSElement";
import { defaultLibraryConfig } from "@storyflow/shared/defaultLibraryConfig";

export const defaultLibrary = {
  Outlet: () => (
    <cms.div
      style={{
        padding: "15px",
        textAlign: "center",
        color: "#0005",
        backgroundColor: "#fff",
      }}
    >
      [Outlet]
    </cms.div>
  ),
  Loop: ({ children }) => {
    return <>{children}</>;
  },
  Link: ({ href, label }) => {
    return <cms.a href={href || "/"}>{label}</cms.a>;
  },
  Text: ({ children }) => {
    return <cms.p>{children}</cms.p>;
  },
  H1: ({ children }) => {
    return <cms.h1>{children}</cms.h1>;
  },
  H2: ({ children }) => {
    return <cms.h2>{children}</cms.h2>;
  },
  H3: ({ children }) => {
    return <cms.h3>{children}</cms.h3>;
  },
  Image: () => {
    return <div>Image component must be implemented by user.</div>;
  },
} satisfies Library<typeof defaultLibraryConfig>;
