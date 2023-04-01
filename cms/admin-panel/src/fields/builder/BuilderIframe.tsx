import React from "react";
import { useClientConfig } from "../../client-config";
import { useBranchIsFocused } from "../../layout/components/BranchFocusContext";
import { useUrlInfo } from "../../users";

export const BuilderIframe = React.forwardRef<
  HTMLIFrameElement,
  { uniqueId: string }
>(({ uniqueId }, ref) => {
  const { builderUrl } = useClientConfig();

  const { id } = useBranchIsFocused();

  const { organization } = useUrlInfo();

  return React.useMemo(
    () =>
      builderUrl ? (
        <iframe
          ref={ref}
          src={`${builderUrl}?uniqueId=${uniqueId}&slug=${organization}`}
          className="w-full h-full bg-white"
          data-select={id}
        />
      ) : null,
    [id, builderUrl]
  );
});
