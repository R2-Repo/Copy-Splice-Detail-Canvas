import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/neumorphic-tokens.css";
import "./styles/neumorphic.css";
import "./styles/global.css";
import "./styles/splice-diagram.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
