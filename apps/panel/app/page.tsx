"use client";

import { App } from "admin-panel";
import React from "react";

const organization =
  process.env.NODE_ENV === "development"
    ? {
        slug: "dashboard",
        url: "http://localhost:4000",
      }
    : undefined;

export default function Page() {
  const [render, setRender] = React.useState(false);
  React.useEffect(() => setRender(true), []);

  return render ? <App organization={organization} lang="da" /> : null;
}
