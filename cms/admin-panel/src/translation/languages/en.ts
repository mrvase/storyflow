import type { Translation } from "../types";

export const en = {
  general: {
    accept: "Accept",
    title: "Title",
  },
  folders: {
    folders: "Folders",
    noFolders: "No folders",
    websites: "Websites",
    addTemplate: "Add template",
    home: "Home",
    templates: "Templates",
    addFolder: "Add",
    deleteSpace: "Delete space",
    editTemplate: 'Edit template "{{label}}"',
    changeTemplate: "Change template",
    unknownDomain: "Unknown domain",
    pagesChanged: "{{count}} (page|pages) changed",
    refresh: "Refresh",
  },
  documents: {
    documents: "(Document|Documents)",
    templates: "(Template|Templates)",
    allTemplates: "All templates",
    pages: "(Page|Pages)",
    noDocuments: "No documents",
    addDocuments: "Add(|)",
    deleteDocuments: "Delete (document|documents)",
    importDocuments: "Import (document|documents)",
    exportDocuments: "Export (document|documents)",
    unnamedDocument: "Unnamed document",
    unsavedTemplate: "Unsaved template",
    addSubPage: "Add subpage",
    addFrontPage: "Add front page",
    removeTemplate: "Remove",
    applyTemplate: "Apply",
    chooseTemplate: "Choose template",
    chooseExistingTemplate: "Choose existing",
    createNewTemplate: "Add new",
  },
  numerals: {
    1: "one",
    2: "two",
    3: "three",
    4: "four",
    5: "five",
    6: "six",
    7: "seven",
    8: "eight",
    9: "nine",
    10: "ten",
  },
  ordinals: {
    1: "1st",
    2: "2nd",
    3: "3rd",
    defaultSuffix: "th",
  },
} as const satisfies Translation;

export type BaseTranslation = typeof en;
