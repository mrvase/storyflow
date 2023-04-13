import React from "react";
import { FieldProps } from "../RenderField";
import { ComputationOp } from "shared/operations";
import { createComputationTransformer } from "shared/computation-tools";
import { useDocumentPageContext } from "../../documents/DocumentPageContext";
import { getDocumentId, getRawFieldId } from "@storyflow/backend/ids";
import { useDocumentCollab } from "../../documents/collab/DocumentCollabContext";
import { DefaultField } from "./DefaultField";
import { PreloadFieldState } from "./PreloadFieldState";
import { useAttributesContext } from "../Attributes";
import { ExtendPath } from "../Path";

export function DefaultFieldRoot({ id, version, history }: FieldProps) {
  /*
  if (id === "") {
    return (
      <div className="text-gray-400 leading-6 pb-5">
        Intet indhold
      </div>
    );
  }
  */

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

  const [currentProp] = useAttributesContext();
  const currentId = currentProp ?? id;

  return (
    <>
      <PreloadFieldState id={id} />
      <ExtendPath id={currentId} type="field">
        <DefaultField key={currentId} id={currentId} showPromptButton />
      </ExtendPath>
    </>
  );
}
