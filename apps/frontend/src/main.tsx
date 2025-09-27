import React from 'react'
import { store, StoreProvider } from "./store/storeContext"
import { createRoot } from "react-dom/client"
import App from "@/layout/App"

const render = async () => {
  // 初始化一些东西
  await store.dispatch.appModel.init()

  const container = document.getElementById('app')
  if (container) {
    const root = createRoot(container)
    root.render(
      <StoreProvider>
        <App />
      </StoreProvider>,
    )
  } else {
    console.error('Root element not found')
  }
}

render()
