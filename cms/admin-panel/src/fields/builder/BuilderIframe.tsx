import React from "react";
import { useClientConfig } from "../../client-config";
import { useBranchIsFocused } from "../../layout/components/BranchFocusContext";
import { useUrlInfo } from "../../users";

export const BuilderIframe = React.forwardRef<
  HTMLIFrameElement,
  {
    uniqueId: string;
    heightListener: (callback: (value: number) => void) => void;
  }
>(({ uniqueId }, ref) => {
  const { builderUrl } = useClientConfig();
  const { id } = useBranchIsFocused();
  const { organization } = useUrlInfo();

  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useLayoutEffect(() => {
    scrollRef.current?.scrollTo(0, 384);
  }, []);

  return builderUrl ? (
    <div
      ref={scrollRef}
      className="w-full h-full overflow-auto no-scrollbar snap-mandatory snap-x"
    >
      <div className="w-[200%] py-96">
        <div className="w-1/2 p-5 snap-start">
          <iframe
            ref={ref}
            src={`${builderUrl}?uniqueId=${uniqueId}&slug=${organization}`}
            className="w-full min-h-screen bg-white"
            data-select={id}
          />
        </div>
      </div>
    </div>
  ) : null;
});
