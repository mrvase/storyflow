import * as React from "react";
import { cms } from "./CMSElement";

/*
const OutletContext = React.createContext<{
  outlet: React.ReactNode;
  register: () => void;
} | null>(null);

export function OutletProvider({
  children,
  outlet,
}: {
  children: React.ReactNode;
  outlet: React.ReactNode;
}) {
  const [found, register] = React.useReducer(() => true, false);
  const [mounted, registerMount] = React.useReducer(() => true, false);
  React.useEffect(() => {
    console.log("PARENT");
    registerMount();
  }, []);

  const ctx = React.useMemo(
    () => ({
      outlet,
      register,
    }),
    [outlet]
  );

  return (
    <OutletContext.Provider value={ctx}>
      {children}
      {mounted && !found ? outlet : null}
    </OutletContext.Provider>
  );
}

export function useOutlet() {
  return React.useContext(OutletContext);
}

const Outlet = () => {
  const { outlet, register } = useOutlet() ?? {
    outlet: null,
    register: () => {},
  };
  React.useLayoutEffect(() => {
    console.log("CHILD");
    register();
  }, []);
  return (
    outlet ?? (
      <cms.div
        style={{
          padding: "15px",
          textAlign: "center",
          color: "#0005",
          backgroundColor: "#fff",
        }}
      >
        [Outlet]
      </cms.div>
    )
  );
};

export default Outlet;
*/
