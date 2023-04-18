import React from "react";
import { useGlobalState } from "../../state/state";
import {
  FieldConfig,
  FieldId,
  NestedDocument,
  NestedDocumentId,
  NestedElement,
  NestedField,
  NestedFolder,
} from "@storyflow/backend/types";
import { extendPath } from "@storyflow/backend/extendPath";
import { getConfigFromType, useClientConfig } from "../../client-config";
import { useFieldTemplate } from "./useFieldTemplate";
import {
  computeFieldId,
  createTemplateFieldId,
  getIdFromString,
} from "@storyflow/backend/ids";
import { useFieldId } from "../FieldIdContext";
import { useDocumentPageContext } from "../../documents/DocumentPageContext";
import { tokens } from "@storyflow/backend/tokens";
import { getChildrenDocuments } from "shared/computation-tools";
import { useDefaultState } from "./useDefaultState";
import { splitTransformsAndRoot } from "@storyflow/backend/transform";
import { useLoopTemplate } from "./LoopTemplateContext";
import { useFieldVersion } from "./VersionContext";

const noTemplate: FieldConfig[] = [];

export function PreloadFieldState({
  id,
  createTemplateContext,
}: {
  id: FieldId;
  createTemplateContext?: NestedDocumentId;
}) {
  const version = useFieldVersion();
  const { tree } = useDefaultState(id, version);

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
        <PreloadNestedState key={child.id} entity={child} />
      ))}
    </>
  );
}

function PreloadNestedState({
  entity,
}: {
  entity: NestedFolder | NestedField | NestedElement | NestedDocument;
}) {
  const id = useFieldId();

  let ids: FieldId[] = [];

  let createTemplateContext = false;

  if (tokens.isNestedFolder(entity)) {
    const template = useFieldTemplate(id) ?? noTemplate;

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
    const { libraries } = useClientConfig();
    const { record } = useDocumentPageContext();

    const config = getConfigFromType(entity.element, libraries);
    const props = config?.props ?? [];

    ids = React.useMemo(() => {
      const keyId = computeFieldId(entity.id, getIdFromString("key"));

      return props.reduce(
        (acc: FieldId[], prop) => {
          if (prop.type === "group") {
            const nestedIds = prop.props.map((innerProp) => {
              const id = computeFieldId(
                entity.id,
                getIdFromString(extendPath(prop.name, innerProp.name, "#"))
              );
              return id;
            });
            acc.push(...nestedIds);
          } else {
            const id = computeFieldId(entity.id, getIdFromString(prop.name));
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
    const template = useFieldTemplate(id) ?? noTemplate;

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
