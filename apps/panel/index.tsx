import "./index.css";
import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "admin-panel";

const [slug, url] = (typeof process.env.TEST_ORG ?? "").split(",");

const organization =
  slug && url
    ? {
        slug,
        url,
      }
    : undefined;

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App organization={organization} />
  </React.StrictMode>
);
