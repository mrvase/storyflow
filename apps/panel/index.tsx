import "./index.css";
import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "admin-panel";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App lang="da" />
  </React.StrictMode>
);
