import React from "react";
import cl from "clsx";
import { useLocalStorage } from "../../state/useLocalStorage";
import Nav from "./Nav";
import Sidebar from "./Sidebar";

export function Layout({ children }: { children: React.ReactNode }) {
  const [sidebarIsOpen] = useLocalStorage<boolean>("sidebar-is-open", false);
  const [navIsOpen] = useLocalStorage<boolean>("nav-is-open", true);
  const [isMounted, setIsMounted] = React.useState(false);
  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  return (
    <div
      className={cl(
        "flex w-full h-screen transition-opacity duration-300",
        isMounted ? "opacity-100" : "opacity-0"
      )}
    >
      <Nav />
      <div
        className="flex flex-col h-screen grow-0 shrink-0 ease-out mx-2"
        style={{
          width: `calc(${[
            "100%",
            "1rem",
            navIsOpen ? "15rem" : "2.5rem",
            sidebarIsOpen && "12rem",
          ]
            .filter(Boolean)
            .join(" - ")})`,
        }}
      >
        <div className="w-full grow overflow-hidden">{children}</div>
      </div>
      <Sidebar />
    </div>
  );
}
