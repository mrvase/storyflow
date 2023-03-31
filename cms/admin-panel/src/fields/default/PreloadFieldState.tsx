import React from "react";
import { useGlobalState } from "../../state/state";
import {
  FieldId,
  FieldType,
  NestedDocument,
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
import { noTemplate } from "./DefaultField";

export function PreloadFieldState({ id }: { id: FieldId }) {
  const { tree } = useDefaultState(id);

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
        <PreloadFieldState key={id} id={id} />
      ))}
    </>
  );
}
