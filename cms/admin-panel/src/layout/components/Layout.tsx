import { useLocalStorage } from "../../state/useLocalStorage";
import Nav from "./Nav";
import Sidebar from "./Sidebar";
import { Panels } from "./Panels";

export function Layout() {
  const [sidebarIsOpen] = useLocalStorage<boolean>("sidebar-is-open", false);
  const [navIsOpen] = useLocalStorage<boolean>("nav-is-open", true);

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-950 text-gray-800 dark:text-white">
      <Nav />
      <div
        className="flex flex-col h-screen grow-0 shrink-0 transition-[width] ease-out mx-2"
        style={{
          width: `calc(${[
            "100%",
            "1rem",
            navIsOpen ? "12rem" : "2.25rem",
            sidebarIsOpen && "12rem",
          ]
            .filter(Boolean)
            .join(" - ")})`,
        }}
      >
        <div className="w-full grow overflow-hidden">
          <Panels />
        </div>
      </div>
      <Sidebar />
    </div>
  );
}
