import React from "react";
import { useClientConfig } from "../../client-config";
import { useBranchIsFocused } from "../../layout/components/BranchFocusContext";
import { useUrlInfo } from "../../users";
import { IframeContext } from "./IframeContext";

export default function BuilderIframe() {
  const ctx = React.useContext(IframeContext);
  if (!ctx) throw new Error("useContext cannot find IframeContext.Provider");

  const { builderUrl } = useClientConfig();

  const { id } = useBranchIsFocused();

  const { organization } = useUrlInfo();

  return React.useMemo(
    () =>
      builderUrl ? (
        <iframe
          ref={ctx.iframeRef}
          src={`${builderUrl}?uniqueId=${ctx.uniqueId}&slug=${organization}`}
          className="w-full h-full bg-white"
          data-select={id}
        />
      ) : null,
    [id, builderUrl]
  );
}
