import { cms } from "@storyflow/react";
import { Component } from "@storyflow/react/config";
import { NavType } from "./NavType";

export const Nav = (({ children }) => {
  return (
    <cms.nav className="px-20 py-8 bg-gray-100 flex gap-3">{children}</cms.nav>
  );
}) satisfies Component<typeof NavType>;
