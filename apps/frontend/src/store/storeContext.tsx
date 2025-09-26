import React, { FC } from "react"
import { Provider } from "react-redux"
import { init, RematchDispatch, RematchRootState } from "@rematch/core"
import { models, RootModel } from "./models/index"
import immerPlugin from "@rematch/immer"
import loadingPlugin from "@rematch/loading"
import persistPlugin from "@rematch/persist"
import { STORAGE_BASE_KEY } from "@/constant/storage"
import storage from "redux-persist/lib/storage"

const immer = immerPlugin()
const loading = loadingPlugin()
const persist = persistPlugin({
  key: STORAGE_BASE_KEY,
  storage,
  whitelist: ["user"],
})

export const store = init({
  models,
  plugins: [immer, loading, persist],
})

// Provider 组件
export const StoreProvider: FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <Provider store={store}>
      {children}
    </Provider>
  )
}

export type Store = typeof store
export type Dispatch = RematchDispatch<RootModel>
export type RootState = RematchRootState<RootModel>
