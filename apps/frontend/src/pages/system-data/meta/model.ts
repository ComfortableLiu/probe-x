import { createModel } from "@rematch/core"
import { RootModel } from "@/store/models"
import { ISystemDataMetaState } from "./type"
import {
  getCleaningStats,
  getDataTrend,
  getFinalCleaningDetail,
  getFirstCleaningDetail,
  getMetaOverview,
  IDataTrendParams,
  IDateParams,
} from "./services" // 导入API服务

const initState: ISystemDataMetaState = {
  // 初始化系统数据元信息状态，包含概览、趋势、清洗统计等数据
  overview: {
    originalDataTotal: '', // 原始数据总量
    finalCleanedData: '', // 最终清洗数据量
    firstCleaningSuccessRate: 0, // 初次清洗成功率
    finalCleaningSuccessRate: 0, // 最终清洗成功率
  },
  dataTrend: {
    xAxis: [], // 数据趋势X轴（通常是时间）
    series: [], // 数据趋势系列数据
  },
  cleaningStats: {
    firstCleaning: { // 初次清洗统计
      successRate: 0, // 成功率
      successCount: '', // 成功数量
      failCount: '', // 失败数量
    },
    finalCleaning: { // 最终清洗统计
      successRate: 0, // 成功率
      successCount: '', // 成功数量
      failCount: '', // 失败数量
    },
  },
  firstCleaningDetail: { // 初次清洗详情
    successRate: 0, // 成功率
    successCount: '', // 成功数量
    failCount: '', // 失败数量
    detailList: [], // 详情列表
  },
  finalCleaningDetail: { // 最终清洗详情
    successRate: 0, // 成功率
    successCount: '', // 成功数量
    failCount: '', // 失败数量
    detailList: [], // 详情列表
  },
}

const systemDataMetaModel = createModel<RootModel>()({
  name: 'systemDataMetaModel',
  state: initState,
  reducers: {
    // 更新状态项的通用方法
    updateItem(state, payload) {
      return {
        ...state,
        ...payload,
      }
    },
    // 设置元数据概览信息
    setOverview(state, payload) {
      return {
        ...state,
        overview: payload,
      }
    },
    // 设置数据趋势信息
    setDataTrend(state, payload) {
      return {
        ...state,
        dataTrend: payload,
      }
    },
    // 设置清洗统计数据
    setCleaningStats(state, payload) {
      return {
        ...state,
        cleaningStats: payload,
      }
    },
    // 设置初次清洗详情
    setFirstCleaningDetail(state, payload) {
      return {
        ...state,
        firstCleaningDetail: payload,
      }
    },
    // 设置最终清洗详情
    setFinalCleaningDetail(state, payload) {
      return {
        ...state,
        finalCleaningDetail: payload,
      }
    },
  },
  effects: (dispatch) => ({
    // 获取元数据概览信息的异步方法
    async getMetaOverview(params: IDateParams) {
      try {
        const response = await getMetaOverview(params)
        dispatch.systemDataMetaModel.setOverview(response.data)
        return response
      } catch (error) {
        console.error('获取元数据概览失败:', error)
        throw error
      }
    },
    // 获取数据趋势信息的异步方法
    async getDataTrend(params: IDataTrendParams) {
      try {
        const response = await getDataTrend(params)
        dispatch.systemDataMetaModel.setDataTrend(response.data)
        return response
      } catch (error) {
        console.error('获取数据趋势失败:', error)
        throw error
      }
    },
    // 获取清洗统计数据的异步方法
    async getCleaningStats(params: IDateParams) {
      try {
        const response = await getCleaningStats(params)
        dispatch.systemDataMetaModel.setCleaningStats(response.data)
        return response
      } catch (error) {
        console.error('获取清洗统计失败:', error)
        throw error
      }
    },
    // 获取初次清洗详情的异步方法
    async getFirstCleaningDetail(params: IDateParams) {
      try {
        const response = await getFirstCleaningDetail(params)
        dispatch.systemDataMetaModel.setFirstCleaningDetail(response.data)
        return response
      } catch (error) {
        console.error('获取初次清洗详情失败:', error)
        throw error
      }
    },
    // 获取最终清洗详情的异步方法
    async getFinalCleaningDetail(params: IDateParams) {
      try {
        const response = await getFinalCleaningDetail(params)
        dispatch.systemDataMetaModel.setFinalCleaningDetail(response.data)
        return response
      } catch (error) {
        console.error('获取最终清洗详情失败:', error)
        throw error
      }
    },
  }),
})

export default systemDataMetaModel
