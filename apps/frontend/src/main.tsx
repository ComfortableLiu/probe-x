import React from 'react'
import { createRoot } from "react-dom/client"
import App from "@/layout/App"
import dayjs from 'dayjs'
import weekday from 'dayjs/plugin/weekday'
import localeData from 'dayjs/plugin/localeData'
import 'dayjs/locale/zh-cn'
import { store } from "@/store/storeContext"

dayjs.extend(weekday)
dayjs.extend(localeData)
dayjs.locale('zh-cn')

const render = async () => {
  // 初始化一些东西
  await store.dispatch.appModel.init()

  const container = document.getElementById('app')
  if (container) {
    const root = createRoot(container)
    root.render(<App />)
  } else {
    console.error('Root element not found')
  }
}

render()
