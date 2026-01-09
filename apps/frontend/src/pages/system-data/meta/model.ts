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
        // 确保 overview 不为 null，如果为 null 则使用默认值
        const overview = response.data || {
          originalDataTotal: '',
          finalCleanedData: '',
          firstCleaningSuccessRate: 0,
          finalCleaningSuccessRate: 0,
        }
        dispatch.systemDataMetaModel.setOverview(overview)
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
        // 确保 dataTrend 不为 null，如果为 null 则使用默认值
        const dataTrend = response.data || {
          xAxis: [],
          series: [],
        }
        dispatch.systemDataMetaModel.setDataTrend(dataTrend)
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
        // 确保 cleaningStats 不为 null，如果为 null 则使用默认值
        const cleaningStats = response.data || {
          firstCleaning: {
            successRate: 0,
            successCount: '',
            failCount: '',
          },
          finalCleaning: {
            successRate: 0,
            successCount: '',
            failCount: '',
          },
        }
        dispatch.systemDataMetaModel.setCleaningStats(cleaningStats)
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
        // 确保 firstCleaningDetail 不为 null，如果为 null 则使用默认值
        const firstCleaningDetail = response.data || {
          successRate: 0,
          successCount: '',
          failCount: '',
          detailList: [],
        }
        dispatch.systemDataMetaModel.setFirstCleaningDetail(firstCleaningDetail)
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
        // 确保 finalCleaningDetail 不为 null，如果为 null 则使用默认值
        const finalCleaningDetail = response.data || {
          successRate: 0,
          successCount: '',
          failCount: '',
          detailList: [],
        }
        dispatch.systemDataMetaModel.setFinalCleaningDetail(finalCleaningDetail)
        return response
      } catch (error) {
        console.error('获取最终清洗详情失败:', error)
        throw error
      }
    },
  }),
})

export default systemDataMetaModel
