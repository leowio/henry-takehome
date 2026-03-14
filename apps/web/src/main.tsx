import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Provider as JotaiProvider } from "jotai";
import { BrowserRouter } from "react-router-dom";

import App from "./App";
import "./styles.css";

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <JotaiProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </JotaiProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
