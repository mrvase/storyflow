import * as React from "react";
import {
  ClientSyntaxTree,
  Component,
  Config,
  ConfigRecord,
  Context,
  ContextProvider,
  PropConfig,
  PropConfigRecord,
  PropGroup,
  ValueArray,
  context,
} from "@storyflow/shared/types";
import { ExtendPath, useConfig, usePath } from "./contexts";
import {
  focusCMSElement,
  getSiblings,
  isActiveEl,
  isActiveSibling,
} from "./focus";
import { log, useValue } from "../builder/RenderBuilder";
import { getConfigByType } from "../src/getConfigByType";
import { extendPath } from "../utils/extendPath";
import RenderChildren from "./RenderChildren";
import { getIdFromString } from "@storyflow/shared/getIdFromString";
import { NoEditor } from "./editor";
import {
  getComponentContextCreator,
  normalizeProp,
  resolveStatefulProp,
  splitProps,
} from "../utils/splitProps";

type LoopIndexRecord = Record<string, number>;

export const LoopContext = React.createContext<LoopIndexRecord>({});
export const IndexContext = React.createContext(0);
export const SpreadContext = React.createContext(false);

const ServerContextsContext = React.createContext<Context[]>([]);

const initialLoop = {};

function LoopProvider({
  id,
  index,
  children,
}: {
  id: string;
  index: number;
  children: React.ReactNode;
}) {
  const current = React.useContext(LoopContext) ?? initialLoop;

  return (
    <LoopContext.Provider
      value={React.useMemo(() => ({ ...current, [id]: index }), [current])}
    >
      {children}
    </LoopContext.Provider>
  );
}

export default function RenderElement({
  type,
  options,
}: {
  type: string;
  options?: ConfigRecord;
}) {
  const { configs, libraries } = useConfig();

  const path = usePath();
  const elementId = path.slice(-1)[0];

  let { config, component } = getConfigByType(type, {
    configs,
    libraries,
    options,
  });

  if (!config || !component) {
    return null;
  }

  const uncomputedProps = Object.fromEntries(
    Object.entries(config.props).reduce((acc, [name, cur]) => {
      if (cur.type === "group") {
        const groupName = name;
        Object.entries(cur.props).forEach(([name, el]) => {
          const id = `${elementId.slice(12, 24)}${getIdFromString(
            extendPath(groupName, name, "#")
          )}`;
          acc.push([id, useValue(id) ?? []]);
        });
      } else {
        const id = `${elementId.slice(12, 24)}${getIdFromString(name)}`;
        acc.push([id, useValue(id) ?? []]);
      }
      return acc;
    }, [] as [string, ValueArray | ClientSyntaxTree][])
  );

  React.useEffect(() => {
    const activeEl = document.activeElement as HTMLElement;
    if (isActiveSibling(activeEl, path)) {
      focusCMSElement(path);
    }
  }, []);

  let prevType = React.useRef(type);

  React.useEffect(() => {
    if (type !== prevType.current) {
      focusCMSElement(path);
    }
    return () => {
      prevType.current = type;
    };
  }, [type]);

  React.useLayoutEffect(() => {
    return () => {
      // onDestroy
      const activeEl = document.activeElement as HTMLElement;
      if (isActiveEl(activeEl, path)) {
        const siblings = getSiblings(activeEl);
        const index = siblings.findIndex((el) => el === activeEl);
        if (index < siblings.length - 1) {
          requestAnimationFrame(() => siblings[index + 1].focus());
        } else if (siblings.length > 1) {
          requestAnimationFrame(() => siblings[siblings.length - 2].focus());
        }
      }
    };
  }, []);

  const props = {
    props: config.props,
    component,
    record: uncomputedProps,
    id: elementId,
    createComponentContext: getComponentContextCreator(config?.provideContext),
  };

  if (type === "Loop") {
    const rawDocumentId = elementId.slice(12, 24);
    const dataId = `${rawDocumentId}${getIdFromString("data")}`;
    return (
      <SpreadContext.Provider value={true}>
        {(uncomputedProps[dataId] as ValueArray).map((_, index) => {
          return (
            <LoopProvider key={index} id={rawDocumentId} index={index}>
              <RenderElementWithProps parentOptions={options} {...props} />
            </LoopProvider>
          );
        })}
      </SpreadContext.Provider>
    );
  }

  return <RenderElementWithProps {...props} />;
}

function RenderElementWithProps({
  id,
  record,
  props,
  component: Component,
  createComponentContext,
  parentOptions,
}: {
  id: string;
  record: Record<string, ValueArray | ClientSyntaxTree>;
  props: Config["props"];
  component: Component<PropConfigRecord>;
  createComponentContext: (regularProps: Record<string, any>) => Context[];
  parentOptions?: ConfigRecord;
}) {
  const loopCtx = React.useContext(LoopContext);
  const { transforms } = useConfig();
  // const index = React.useContext(IndexContext);

  const prevContexts = React.useContext(ServerContextsContext);

  const [regularEntries, childrenEntries] = React.useMemo(
    () => splitProps(props),
    [props]
  );

  const regularProps = React.useMemo(() => {
    const resolveProps = (
      entries: [string, PropConfig | PropGroup][],
      group: string = ""
    ) => {
      return Object.fromEntries(
        entries.map(([name, config]): [string, any] => {
          if (config.type === "group") {
            return [name, resolveProps(Object.entries(config.props), name)];
          }
          const key = extendPath(group ?? "", name, "#");
          const fieldId = `${id.slice(12, 24)}${getIdFromString(key)}`;

          const prop = resolveStatefulProp(record[fieldId] ?? [], loopCtx);

          return [name, normalizeProp(config, prop, transforms)];
        })
      );
    };
    return resolveProps(regularEntries);
  }, [record, loopCtx, regularEntries, transforms]);

  const contexts = React.useMemo(() => {
    const newContexts = createComponentContext(regularProps);
    // this early return is important for stable object reference in spite of prop changes
    if (!newContexts.length) return prevContexts;
    return [...prevContexts, ...newContexts];
  }, [prevContexts, regularProps]);

  const childrenProps = React.useMemo(
    () =>
      Object.fromEntries(
        childrenEntries.map(([name, config]): [string, any] => {
          const fieldId = `${id.slice(12, 24)}${getIdFromString(name)}`;
          const value = resolveStatefulProp(record[fieldId] ?? [], loopCtx);

          const children = (
            <ServerContextsContext.Provider value={contexts}>
              <ExtendPath id={fieldId}>
                <RenderChildren
                  value={Array.isArray(value[0]) ? value[0] : value}
                  options={parentOptions ?? (config.options as ConfigRecord)}
                />
              </ExtendPath>
            </ServerContextsContext.Provider>
          );

          return [name, children];
        })
      ),
    [record, loopCtx, childrenEntries, contexts]
  );

  const resolvedProps = React.useMemo(() => {
    return {
      ...regularProps,
      ...childrenProps,
      useServerContext: (provider: ContextProvider) => {
        console.log("PREV", { prevContexts, contexts, regularProps });
        return prevContexts.findLast((c) => c[context] === provider[context])
          ?.value;
      },
    };
  }, [prevContexts, regularProps, childrenProps]);

  log("PROPS PROPS", resolvedProps);

  return (
    <NoEditor>
      <Component {...resolvedProps} />
    </NoEditor>
  );
}
