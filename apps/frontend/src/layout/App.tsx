import React, { Fragment, Suspense } from 'react'
import * as styles from "./style.module.scss"
import '@ant-design/v5-patch-for-react-19'
import MenuView from "./Menu"
import { Route, Routes } from "react-router"
import themeConfig from "../../components/theme/themeConfig"
import { routes } from "@/router"
import Loading from "@/components/Loading"
import "@public/main.css"
import { ConfigProvider } from "antd"
import { BrowserRouter, StaticRouter } from "react-router-dom"
import icon from "@public/icon.png"
import RouteGuard from "@/layout/RouteGuard"
import { StoreProvider } from "@/store/storeContext"

export interface AppProps {
  location?: string;
}

const AppContent = () => {

  return (
    <div className={styles.appMainStyle}>
      <MenuView />
      <main className={styles.appRouterView}>
        <Routes>
          {routes.map((route) => (
            <Fragment key={route.key}>
              {/* 主路由 */}
              <Route
                path={route.path}
                key={route.key}
                element={(
                  <Suspense fallback={<Loading />}>
                    <route.component />
                  </Suspense>
                )}
              />
              {/* 别名路由 */}
              {Array.isArray(route.alias) &&
                route.alias.map((aliasPath) => (
                  <Route
                    key={aliasPath}
                    path={aliasPath}
                    element={(
                      <Suspense fallback={<Loading />}>
                        <route.component />
                      </Suspense>
                    )}
                  />
                ))}
            </Fragment>
          ))}
        </Routes>
      </main>
    </div>
  )
}

const App = ({ location }: AppProps) => {

  // 这个可以兼容后续的SSR
  const RouterComponent = location ? StaticRouter : BrowserRouter

  return (
    <StoreProvider>
      <ConfigProvider theme={themeConfig}>
        <RouterComponent location={location}>
          <link rel="icon" href={icon} />
          <RouteGuard>
            <AppContent />
          </RouteGuard>
        </RouterComponent>
      </ConfigProvider>
    </StoreProvider>
  )
}

export default App
