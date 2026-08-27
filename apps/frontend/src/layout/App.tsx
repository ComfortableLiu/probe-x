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
import { ErrorBoundary } from "@/components/ErrorBoundary"
import zhCN from 'antd/locale/zh_CN'

export interface AppProps {
  location?: string;
}

const AppContent = () => {

  // Guide 路由单独处理：父路由（/guide）作为外壳，子路由嵌套注册，使 /guide/* 页面带 Guide 外壳
  const guideParent = routes.find((route) => route.key === 'guide')
  const guideChildren = routes.filter((route) => route.path.startsWith('/guide/'))
  const otherRoutes = routes.filter((route) => route !== guideParent && !route.path.startsWith('/guide/'))

  // 将 /guide/* 完整路径转为相对路径用于嵌套注册
  const toGuideRelativePath = (path: string) => path.replace(/^\/guide\//, '')

  return (
    <div className={styles.appMainStyle}>
      <MenuView />
      <main className={styles.appRouterView}>
        <Routes>
          {otherRoutes.map((route) => (
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
          {/* Guide 嵌套路由：父路由为 Guide 外壳，子路由渲染到外壳的 Outlet 中 */}
          {guideParent && (
            <Route
              path={guideParent.path}
              element={(
                <Suspense fallback={<Loading />}>
                  <guideParent.component />
                </Suspense>
              )}
            >
              {guideChildren.map((route) => (
                <Fragment key={route.key}>
                  <Route
                    path={toGuideRelativePath(route.path)}
                    element={(
                      <Suspense fallback={<Loading />}>
                        <route.component />
                      </Suspense>
                    )}
                  />
                  {Array.isArray(route.alias) &&
                    route.alias
                      .filter((aliasPath) => aliasPath.startsWith('/guide/'))
                      .map((aliasPath) => (
                        <Route
                          key={aliasPath}
                          path={toGuideRelativePath(aliasPath)}
                          element={(
                            <Suspense fallback={<Loading />}>
                              <route.component />
                            </Suspense>
                          )}
                        />
                      ))}
                </Fragment>
              ))}
            </Route>
          )}
          {/* Guide 父路由别名（如 /guide.html），直接渲染外壳首页 */}
          {guideParent && Array.isArray(guideParent.alias) &&
            guideParent.alias.map((aliasPath) => (
              <Route
                key={aliasPath}
                path={aliasPath}
                element={(
                  <Suspense fallback={<Loading />}>
                    <guideParent.component />
                  </Suspense>
                )}
              />
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
    <ErrorBoundary>
      <StoreProvider>
        <ConfigProvider locale={zhCN} theme={themeConfig}>
          <RouterComponent location={location}>
            <link rel="icon" href={icon} />
            <RouteGuard>
              <AppContent />
            </RouteGuard>
          </RouterComponent>
        </ConfigProvider>
      </StoreProvider>
    </ErrorBoundary>
  )
}

export default App
