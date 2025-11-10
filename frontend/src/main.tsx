import React from "react";
import ReactDOM from "react-dom/client";

import "@livekit/components-styles";
import "./styles.css";
import { AppRouter } from "./Router";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <AppRouter />
  </React.StrictMode>
);



