"use client";

import dynamic from "next/dynamic";
import React from "react";

const organization =
  process.env.NODE_ENV === "development"
    ? {
        slug: "dashboard",
        url: "http://localhost:4000",
      }
    : undefined;

const App = dynamic(() => import("admin-panel").then((mod) => mod.App), {
  ssr: false,
});

export default function Page() {
  return <App organization={organization} lang="da" />;
}
