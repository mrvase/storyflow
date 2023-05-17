import "./index.css";
import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "admin-panel";

const organization = (import.meta as any).env.DEV
  ? {
      slug: "kfs",
      url: "http://localhost:3001",
    }
  : undefined;

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App organization={organization} lang="da" />
  </React.StrictMode>
);
