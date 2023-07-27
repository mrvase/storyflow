import { getIdFromString } from "@storyflow/shared/getIdFromString";
import {
  NestedDocumentId,
  ValueArray,
  ClientSyntaxTree,
  FieldId,
} from "@storyflow/shared/types";
import { getConfigByType } from "../src/getConfigByType";
import { getComponentContextCreator } from "../utils/splitProps";
import { RSCContext } from "./types";
import { RenderElementWithProps } from "./RenderPage";

export function createAction(
  func: (options: {
    url: string;
    id: string;
  }) => Promise<Record<string, ValueArray | ClientSyntaxTree> | null>,
  {
    configs,
    libraries,
    transforms,
  }: {
    configs: any;
    libraries: any;
    transforms: any;
  }
) {
  const action = async (
    id: NestedDocumentId,
    optionNames: string[]
  ): Promise<React.ReactElement[] | null> => {
    const record = await func({ id, url: "" });
    const options = {};

    const symbol = Symbol();

    let { config, component } = getConfigByType("Loop", {
      configs,
      libraries,
      options,
    });

    if (!config || !component || !record) return null;

    const ctx: RSCContext = {
      loopIndexRecord: {},
      contexts: [],
      configs,
      libraries,
      transforms,
      action,
      isOpenGraph: false,
      children: null,
    };

    const props = {
      props: config.props,
      component,
      record,
      id,
      createComponentContext: getComponentContextCreator(
        config?.provideContext
      ),
    };

    const rawDocumentId = id.slice(12, 24);
    const dataId = `${rawDocumentId}${getIdFromString("data")}`;

    return (record[dataId] as ValueArray).map((_, newIndex) => {
      const newCtx = {
        ...ctx,
        loopIndexRecord: {
          [rawDocumentId]: newIndex,
        },
      };
      return (
        <RenderElementWithProps
          key={newIndex}
          ctx={newCtx}
          symbol={symbol}
          index={newIndex}
          parentOptions={options}
          {...props}
        />
      );
    });
  };

  return action;
}
