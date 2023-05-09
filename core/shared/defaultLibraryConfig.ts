import { LibraryConfig } from "./types";

export const defaultLibraryConfig = {
  label: "Default",
  configs: {
    LinkConfig: {
      label: "Link",
      props: {
        label: { type: "string", label: "Label" },
        href: { type: "string", label: "URL" },
      },
      inline: true,
    },
    OutletConfig: {
      label: "Side",
      props: {},
    },
    LoopConfig: {
      label: "Generer fra data",
      props: {
        children: { type: "children", label: "Indhold" },
        data: { type: "data", label: "Data" },
      },
    },
    TextConfig: {
      label: "Tekst",
      props: {
        children: { type: "children", label: "Indhold" },
      },
    },
    H1Config: {
      label: "Overskrift",
      props: {
        children: { type: "children", label: "Indhold" },
      },
    },
    H2Config: {
      label: "Overskrift",
      props: {
        children: { type: "children", label: "Indhold" },
      },
    },
    H3Config: {
      label: "Overskrift",
      props: {
        children: { type: "children", label: "Indhold" },
      },
    },
  },
} satisfies LibraryConfig;
