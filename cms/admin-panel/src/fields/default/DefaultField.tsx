import React from "react";
import { FieldProps } from "../RenderField";
import { ComputationOp } from "shared/operations";
import { getConfig } from "shared/initialValues";
import { createComputationTransformer } from "shared/computation-tools";
import { useDocumentPageContext } from "../../documents/DocumentPageContext";
import { useBuilderPath } from "../BuilderPath";
import { getDocumentId, getRawFieldId } from "@storyflow/backend/ids";
import { useDocumentCollab } from "../../documents/collab/DocumentCollabContext";
import { WritableDefaultField } from "./RenderNestedFields";

export default function DefaultField({
  id,
  fieldConfig,
  version,
  history,
  value,
}: FieldProps) {
  if (id === "") {
    return (
      <div className="text-gray-400 font-light leading-6 pb-5">
        Intet indhold
      </div>
    );
  }

  const initialValue = React.useMemo(
    () => value ?? getConfig(fieldConfig.type).defaultValue,
    []
  );

  const collab = useDocumentCollab();

  const { record } = useDocumentPageContext();

  React.useLayoutEffect(() => {
    /* MUST be useLayoutEffect to run before children useEffects that use the queue */
    collab
      .getOrAddQueue<ComputationOp>(getDocumentId(id), getRawFieldId(id), {
        transform: createComputationTransformer(id, record),
        mergeableNoop: { target: "0:0:", ops: [] },
      })
      .initialize(version, history ?? []);
  }, []);

  const [path] = useBuilderPath();

  return (
    <WritableDefaultField
      id={id}
      hidden={path.length > 0}
      initialValue={initialValue}
      fieldConfig={fieldConfig}
    />
  );
}
