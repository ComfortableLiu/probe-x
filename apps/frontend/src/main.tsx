import React from 'react';
import { StoreProvider } from "./store/storeContext";
import { createRoot } from "react-dom/client";
import App from "@/layout/App";

const container = document.getElementById('app');
if (container) {
  const root = createRoot(container);
  root.render(
    <StoreProvider>
      <App />
    </StoreProvider>
  )
} else {
  console.error('Root element not found');
}
