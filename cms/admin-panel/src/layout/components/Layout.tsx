import { useLocalStorage } from "../../state/useLocalStorage";
import Nav from "./Nav";
import Sidebar from "./Sidebar";
import { Panels } from "./Panels";
import TabBar from "./TabBar";

export function Layout() {
  const [sidebarIsOpen] = useLocalStorage<boolean>("sidebar-is-open", false);
  const [navIsOpen] = useLocalStorage<boolean>("nav-is-open", true);

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-950">
      <Nav />
      <div
        className="flex flex-col h-screen grow-0 shrink-0 transition-[width] ease-out"
        style={{
          width: `calc(${[
            "100%",
            navIsOpen && "12rem",
            sidebarIsOpen && "14rem",
          ]
            .filter(Boolean)
            .join(" - ")})`,
        }}
      >
        <div className="w-[calc(100%-16px)] mx-2 grow overflow-hidden">
          <Panels />
        </div>
        <TabBar />
      </div>
      <Sidebar />
    </div>
  );
}
