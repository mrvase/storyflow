import { DefaultField } from "./DefaultField";
import { PreloadFieldState } from "./PreloadFieldState";
import { useAttributesContext } from "../Attributes";
import { ExtendPath } from "../Path";
import { VersionProvider } from "./VersionContext";
import type { FieldProps } from "../types";

export function DefaultFieldRoot({ id, version }: FieldProps) {
  /*
  const collab = useDocumentCollab();
  const { record } = useDocumentPageContext();

  React.useLayoutEffect(() => {
    // MUST be useLayoutEffect to run before children useEffects that use the queue
    collab
      .getOrAddQueue<FieldOperation>(getDocumentId(id), getRawFieldId(id), {
        transform: createTokenStreamTransformer(id, record),
        mergeableNoop: ["", []],
      })
      .initialize(version, history ?? []);
  }, [collab, version]);
  */

  const [currentProp] = useAttributesContext();
  const currentId = currentProp ?? id;

  return (
    <VersionProvider version={version}>
      <PreloadFieldState id={id} />
      <ExtendPath id={currentId} type="field">
        <DefaultField key={currentId} id={currentId} showPromptButton />
      </ExtendPath>
    </VersionProvider>
  );
}
