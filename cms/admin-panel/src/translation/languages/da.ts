import type { BaseTranslation } from "./en";

type DerivedTranslation = {
  readonly [Namespace in Exclude<
    keyof BaseTranslation,
    "ordinals" | "numerals"
  >]: {
    [KeyboardEvent in keyof BaseTranslation[Namespace]]: string;
  };
} & {
  numerals: Record<number, string>;
  ordinals: Record<number | "defaultSuffix", string>;
};

export const da = {
  general: {
    accept: "Accepter",
    title: "Titel",
    noLabel: "Ingen label",
    hide: "Skjul",
    show: "Vis",
  },
  folders: {
    folders: "Mapper",
    noFolders: "Ingen mapper",
    websites: "Hjemmesider",
    addTemplate: "Tilføj skabelon",
    home: "Hjem",
    templates: "Skabeloner",
    addFolder: "Tilføj(|)",
    deleteSpace: "Slet space",
    editTemplate: 'Rediger skabelon "{{label}}"',
    changeTemplate: "Skift skabelon",
    unknownDomain: "Ukendt domæne",
    pagesChanged: "{{count}} (side|sider) ændret",
    refresh: "Opdater",
  },
  documents: {
    documents: "(Dokument|Dokumenter)",
    templates: "(Skabelon|Skabeloner)",
    allTemplates: "Alle skabeloner",
    pages: "(Side|Sider)",
    noDocuments: "Ingen dokumenter",
    addDocuments: "Tilføj(|)",
    deleteDocuments: "Slet valgt(|e) (dokument|dokumenter)",
    importDocuments: "Importer (dokument|dokumenter)",
    exportDocuments: "Eksporter (dokument|dokumenter)",
    unnamedDocument: "Unavngivet dokument",
    unsavedTemplate: "Ugemt skabelon",
    addSubPage: "Tilføj underside",
    addFrontPage: "Tilføj forside",
    removeTemplate: "Fjern",
    applyTemplate: "Anvend",
    chooseTemplate: "Vælg skabelon",
    chooseExistingTemplate: "Vælg eksisterende",
    createNewTemplate: "Tilføj ny",
  },
  fields: {
    deleteFields: "Slet (felt|felter)",
  },
  numerals: {
    1: "en",
    2: "to",
    3: "tre",
    4: "fire",
    5: "fem",
    6: "seks",
    7: "syv",
    8: "otte",
    9: "ni",
    10: "ti",
  },
  ordinals: {
    1: "første",
    2: "anden",
    3: "tredje",
    4: "fjerde",
    5: "femte",
    6: "sjette",
    7: "syvende",
    8: "ottende",
    9: "niende",
    10: "tiende",
    defaultSuffix: ".",
  },
} as const satisfies DerivedTranslation;
