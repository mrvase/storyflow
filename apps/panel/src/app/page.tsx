"use client";

import dynamic from "next/dynamic";
import React from "react";

const App = dynamic(() => import("admin-panel").then((mod) => mod.App), {
  ssr: false,
});

export default function Page() {
  return <App lang="da" />;
}
