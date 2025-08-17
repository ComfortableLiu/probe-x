import React from 'react';
import App from './layout/App.tsx';
import { StoreProvider } from "./store/storeContext.tsx";
import { createRoot } from "react-dom/client";

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
