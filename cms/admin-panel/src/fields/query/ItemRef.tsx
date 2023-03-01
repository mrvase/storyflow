import React from "react";
import { sortByDomNode } from "./helpers";

type ItemRef = { id: string; ref: React.MutableRefObject<HTMLElement> };
const IndexManagerContext = React.createContext<
  | [
      getIndex: (id: string) => number,
      registerItem: (ref: ItemRef) => () => void
    ]
  | null
>(null);
const IndexManager = ({ children }: { children: React.ReactNode }) => {
  const [list, setList] = React.useState<ItemRef[]>([]);

  const registerItem = ({ id, ref }: ItemRef) => {
    setList((list) => {
      const index = list.findIndex((item) => item.id === id);
      if (index === -1) {
        return sortByDomNode([...list, { id, ref }]);
      } else {
        return list;
      }
    });
    return () => {
      setList((list) =>
        sortByDomNode(
          list.filter((item) => item.id !== id),
          ({ ref }) => ref.current
        )
      );
    };
  };

  const getIndex = (id: string) => {
    return list.findIndex((item) => item.id === id);
  };

  const ctx = React.useMemo(
    () => [getIndex, registerItem] as [typeof getIndex, typeof registerItem],
    [list]
  );

  return (
    <IndexManagerContext.Provider value={ctx}>
      {children}
    </IndexManagerContext.Provider>
  );
};
