import "./storage-polyfill.js";
import React from "react";
import { createRoot } from "react-dom/client";
import HomeBase from "./HomeBase.jsx";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <HomeBase />
  </React.StrictMode>
);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {
      // offline support is a bonus, not a requirement — fail silently
    });
  });
}
