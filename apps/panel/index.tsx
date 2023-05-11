import "./index.css";
import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "admin-panel";

const organization = {
  slug: "semper2",
  url: "http://localhost:3003",
};

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App organization={organization} />
  </React.StrictMode>
);
