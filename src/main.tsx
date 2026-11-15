import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

// Inter bundled locally via @fontsource so the app renders correctly offline
// (venue Wi-Fi may be flaky). Inter is the single UI typeface — headings, body
// and numbers. The only monospace is the tiny coordinate readout (system mono).
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";

import "./styles.css";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Root element #root not found");

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
