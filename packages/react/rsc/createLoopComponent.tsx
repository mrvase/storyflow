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
import { defaultLibraryConfig } from "@storyflow/shared/defaultLibraryConfig";
import { defaultLibrary } from "../src/defaultLibrary";

export function createLoopComponent({
  configs: configsFromProps,
  libraries: librariesFromProps,
  transforms,
}: {
  configs: any;
  libraries: any;
  transforms: any;
}) {
  const configs = {
    ...configsFromProps,
    "": defaultLibraryConfig,
  };

  const libraries = { "": defaultLibrary, ...librariesFromProps };

  const action = ({
    id,
    record,
    options: optionNames,
  }: {
    id: NestedDocumentId;
    record: Record<string, ValueArray | ClientSyntaxTree> | null;
    options: string[];
  }): React.ReactElement | null => {
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
      isOpenGraph: true,
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

    return (
      <>
        {(record[dataId] as ValueArray).map((_, newIndex) => {
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
        })}
      </>
    );
  };

  return action;
}
