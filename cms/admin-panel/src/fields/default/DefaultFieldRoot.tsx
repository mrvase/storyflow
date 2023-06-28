import { DefaultField } from "./DefaultField";
import { PreloadFieldState } from "./PreloadFieldState";
import { useAttributesContext } from "../Attributes";
import { ExtendPath } from "../Path";
import type { FieldProps } from "../types";

export function DefaultFieldRoot({ id }: FieldProps) {
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
