import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./quotes";
import "./quotes.css";
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
