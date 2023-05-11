import React from "react";
import { useAppConfig } from "../../AppConfigContext";
import { useBranchIsFocused } from "../../layout/components/BranchFocusContext";
import { trimTrailingSlash } from "../../utils/trimSlashes";
import { useAuth } from "../../Auth";

export const BuilderIframe = React.forwardRef<
  HTMLIFrameElement,
  {
    uniqueId: string;
    heightListener: (callback: (value: number) => void) => void;
  }
>(({ uniqueId }, ref) => {
  const { baseURL, builderPath } = useAppConfig();
  const { id } = useBranchIsFocused();
  const { organization } = useAuth();

  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useLayoutEffect(() => {
    scrollRef.current?.scrollTo(0, 384);
  }, []);

  return baseURL ? (
    <div
      ref={scrollRef}
      className="w-full h-full overflow-auto no-scrollbar snap-mandatory snap-x"
    >
      <div className="w-[200%] py-96">
        <div className="ml-[25%] w-1/2 p-5 snap-start">
          <iframe
            ref={ref}
            src={`${trimTrailingSlash(baseURL)}${
              builderPath ?? "/builder"
            }?uniqueId=${uniqueId}&slug=${organization!.slug}`}
            className="w-full min-h-screen bg-white"
            data-select={id}
          />
        </div>
      </div>
    </div>
  ) : null;
});
