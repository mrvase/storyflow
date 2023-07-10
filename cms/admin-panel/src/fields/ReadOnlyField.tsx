import { calculateRootFieldFromRecord } from "@storyflow/cms/calculate-server";
import React from "react";
import { useDocumentPageContext } from "../documents/DocumentPageContext";
import { useFieldId } from "./FieldIdContext";
import { getPreview } from "./default/getPreview";

export function ReadOnlyField() {
  const id = useFieldId();
  const { record } = useDocumentPageContext();

  const value = React.useMemo(() => {
    return calculateRootFieldFromRecord(id, record);
  }, [record, id]);

  return <div>{getPreview(value)}</div>;
}
