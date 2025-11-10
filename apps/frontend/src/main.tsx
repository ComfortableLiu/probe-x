import React from 'react'
import { createRoot } from "react-dom/client"
import App from "@/layout/App"

const render = async () => {
  // 初始化一些东西
  // await store.dispatch.appModel.init()

  const container = document.getElementById('app')
  if (container) {
    const root = createRoot(container)
    root.render(<App />)
  } else {
    console.error('Root element not found')
  }
}

render()
