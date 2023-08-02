import { ValueArray, FieldId, ClientSyntaxTree } from "@storyflow/shared/types";
import { RenderPage } from "./RenderPage";

export function createEmailComponent(
  body:
    | string
    | {
        entry: ValueArray | ClientSyntaxTree;
        record: Record<FieldId, ValueArray | ClientSyntaxTree>;
      },
  {
    configs: configsFromProps,
    libraries: librariesFromProps,
    transforms,
  }: {
    configs: any;
    libraries: any;
    transforms: any;
  }
) {
  if (typeof body === "string") {
    return body;
  }

  return (
    <RenderPage
      data={body}
      configs={configsFromProps}
      libraries={librariesFromProps}
      transforms={transforms}
      isOpenGraph
    />
  );
}
