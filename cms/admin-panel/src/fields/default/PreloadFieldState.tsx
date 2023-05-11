import React from "react";
import { useGlobalState } from "../../state/state";
import {
  DocumentId,
  FieldId,
  NestedDocument,
  NestedDocumentId,
  NestedElement,
  NestedFolder,
  RawDocumentId,
} from "@storyflow/shared/types";
import type { FieldConfig, NestedField } from "@storyflow/cms/types";
import { getConfigFromType, useAppConfig } from "../../AppConfigContext";
import { useTemplate } from "./useFieldTemplate";
import {
  computeFieldId,
  createTemplateFieldId,
  getIdFromString,
} from "@storyflow/cms/ids";
import { useFieldId } from "../FieldIdContext";
import { useDocumentPageContext } from "../../documents/DocumentPageContext";
import { tokens } from "@storyflow/cms/tokens";
import { getChildrenDocuments } from "@storyflow/cms/graph";
import { useDefaultState } from "./useDefaultState";
import { splitTransformsAndRoot } from "@storyflow/cms/transform";
import { useLoopTemplate } from "./LoopTemplateContext";
import { extendPath } from "../../utils/extendPath";

const noTemplate: FieldConfig[] = [];

export function PreloadFieldState({
  id,
  createTemplateContext,
}: {
  id: FieldId;
  createTemplateContext?: NestedDocumentId;
}) {
  const { tree, templateId } = useDefaultState(id);

  if (createTemplateContext) {
    const template = React.useMemo(() => {
      return splitTransformsAndRoot(tree)[0].find(
        (el) => el.type === "template"
      )?.data as string | undefined;
    }, [tree]);

    const [, setTemplate] = useLoopTemplate(createTemplateContext, template);
    React.useEffect(() => {
      if (template) setTemplate(`000000000000${template}`);
    }, [template]);
  }

  const children = React.useMemo(() => {
    return getChildrenDocuments(tree);
  }, [tree]);

  return (
    <>
      {children.map((child) => (
        <PreloadNestedState
          key={child.id}
          entity={child}
          templateId={templateId}
        />
      ))}
    </>
  );
}

function PreloadNestedState({
  entity,
  templateId,
}: {
  entity: NestedFolder | NestedField | NestedElement | NestedDocument;
  templateId?: DocumentId | RawDocumentId | null | undefined;
}) {
  const id = useFieldId();

  let ids: FieldId[] = [];

  let createTemplateContext = false;

  if (tokens.isNestedFolder(entity)) {
    const template = useTemplate(templateId) ?? noTemplate;

    ids = template.map((el) => {
      return createTemplateFieldId(entity.id, el.id);
    });

    const [, setTemplate] = useGlobalState(`${entity.id}#template`, () =>
      template.map((el) => el.id)
    );

    const prevTemplate = React.useRef(template);

    React.useEffect(() => {
      if (template !== prevTemplate.current) {
        setTemplate(() => template.map((el) => el.id));
      }
    }, [template]);
  } else if (tokens.isNestedField(entity)) {
    // missing
  } else if (tokens.isNestedElement(entity)) {
    const { configs } = useAppConfig();
    const { record } = useDocumentPageContext();

    const config = getConfigFromType(entity.element, configs);
    const props = config?.props ?? {};

    ids = React.useMemo(() => {
      const keyId = computeFieldId(entity.id, getIdFromString("key"));

      return Object.entries(props).reduce(
        (acc: FieldId[], [name, prop]) => {
          if (prop.type === "group") {
            const nestedIds = Object.entries(prop.props).map(([innerName]) => {
              const id = computeFieldId(
                entity.id,
                getIdFromString(extendPath(name, innerName, "#"))
              );
              return id;
            });
            acc.push(...nestedIds);
          } else {
            const id = computeFieldId(entity.id, getIdFromString(name));
            acc.push(id);
          }
          return acc;
        },
        [keyId] as FieldId[]
      );
    }, [props, record]);

    if (entity.element === "Loop") {
      createTemplateContext = true;
    }
  } else if (tokens.isNestedDocument(entity)) {
    const template = useTemplate(templateId) ?? noTemplate;

    ids = React.useMemo(() => {
      return template.map((el) => {
        return createTemplateFieldId(entity.id, el.id);
      });
    }, [template]);
  }

  return (
    <>
      {ids.map((id) => (
        <PreloadFieldState
          key={id}
          id={id}
          createTemplateContext={
            createTemplateContext && id.endsWith(getIdFromString("data"))
              ? (entity.id as NestedDocumentId)
              : undefined
          }
        />
      ))}
    </>
  );
}
