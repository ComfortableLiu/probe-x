import React, { FC } from "react"
import { Provider } from "react-redux"
import { init, RematchDispatch, RematchRootState } from "@rematch/core"
import { models, RootModel } from "./models/index"
import loadingPlugin, { ExtraModelsFromLoading, LoadingConfig } from "@rematch/loading"
import persistPlugin from "@rematch/persist"
import { STORAGE_BASE_KEY } from "@/constant/storage"
import storage from "redux-persist/lib/storage"

type FullModel = ExtraModelsFromLoading<RootModel>

// const immer = immerPlugin<RootModel, FullModel>()
const loading = loadingPlugin<RootModel, FullModel, LoadingConfig>()
const persist = persistPlugin<any, RootModel, FullModel>({
  key: STORAGE_BASE_KEY,
  storage,
  whitelist: [],
  version: 1,
})

export const store = init({
  models,
  plugins: [loading, persist],
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
export type RootState = RematchRootState<RootModel, FullModel>
