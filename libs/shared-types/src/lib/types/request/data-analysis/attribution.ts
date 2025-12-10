import { IAttributionAnalysisFilter } from "./common"
import { IEventAnalysisInfo } from "./event"

/**
 * 归因模型枚举
 * 定义支持的归因分析算法类型
 */
export enum AttributionModelEnum {
  // 首次触点归因：将转化credit100%分配给用户首次接触的触点
  FIRST_TOUCH = "first_touch",
  // 末次触点归因：将转化credit100%分配给用户最后接触的触点
  LAST_TOUCH = "last_touch",
  // 线性归因：将转化credit平均分配给用户所有接触的触点
  LINEAR = "linear",
  // 位置归因：首次/末次触点各占40%，中间触点平分剩余20%
  POSITION = "position",
  // 时间衰减归因：触点价值随时间衰减，越接近转化的触点权重越高
  TIME_DECAY = "time_decay",
}

/**
 * 归因分析请求入参接口
 * 用于接收前端传递的归因分析查询参数
 */
export interface IAttributionAnalysisReq {
  // 归因模式：指定使用哪种归因算法（枚举值）
  attributionModel: AttributionModelEnum
  // 转化目标指标：定义需要分析的转化事件及指标
  targetMetric: {
    // 转化事件详情（事件名、指标类型、过滤条件等）
    eventInfo: IEventAnalysisInfo
  }
  // 转化目标指标维度：需要分析的转化事件维度（如$device、$channel等）
  targetDimension: string[]
  // 时间范围：查询的时间区间，格式为[开始日期, 结束日期]，日期格式YYYY-MM-DD
  timeRange: [`${string}-${string}-${string}`, `${string}-${string}-${string}`]
  // 归因事件：需要分析的触点事件列表（支持多个触点事件）
  attributionEvent: {
    // 归因事件详情（事件名、指标类型、过滤条件等）
    eventInfo: IEventAnalysisInfo
  }[]
  // 归因事件维度：需要分析的触点事件维度（如$device_id、$viewport_width等）
  attributionEventDimension: string[]
  // 全局筛选：所有事件共用的过滤条件（可选）
  globalFilters?: IAttributionAnalysisFilter[]
}

/**
 * 归因分析表格列配置接口
 * 用于定义前端表格的表头结构，支持合并单元格
 */
export interface IAttributionTableHeader {
  // 第一行表头（合并单元格层级）
  firstHeader: {
    // 触点列标题（合并单元格）
    touchPoint: string;
    // 转化事件列标题（合并单元格，格式：转化事件：{事件名}）
    conversionEvent: string;
  };
  // 第二行表头（具体列层级）
  secondHeader: {
    // 触点部分列标题列表（归因事件、维度1、维度2...总次数、用户数）
    touchPointHeaders: string[];
    // 转化事件部分列标题列表（转化指标、转化率、贡献度）
    conversionHeaders: string[];
  };
}

/**
 * 归因分析表格行数据接口
 * 定义表格单行数据的结构，区分触点和转化事件两部分
 */
export interface IAttributionTableRow {
  // 触点部分数据
  touchPointData: {
    // 归因事件名称（如page_leave、page_view）
    attributionEventName: string;
    // 动态维度值：键为维度名（如$device_id），值为维度对应的具体值
    [dimensionKey: string]: string | number | null;
    // 归因事件总次数：该触点事件的触发总次数
    total_count: number;
    // 归因事件用户数：触发该触点事件的唯一用户数
    user_count: number;
  };
  // 转化事件部分数据
  conversionData: {
    // 转化指标值：该触点贡献的转化数量（如转化用户数、转化次数）
    conversionMetric: number;
    // 转化率：该触点的转化效率（百分比）
    conversionRate: number;
    // 贡献度：该触点对整体转化的贡献情况
    contribution: {
      // 贡献度百分比：该触点贡献占总转化的比例
      rate: number;
      // 贡献度进度条值：用于前端展示进度条（0-100）
      progress: number;
    };
  };
}

/**
 * 最终归因分析返回值接口
 * 前端渲染表格的完整数据结构
 */
export interface IAttributionAnalysisRes {
  // 表格表头配置（适配合并单元格）
  tableHeader: IAttributionTableHeader;
  // 表格行数据列表
  tableData: IAttributionTableRow[];
  // 总计数据：整个查询的汇总统计
  total: {
    // 总转化指标值：所有触点的转化指标总和
    totalConversionMetric: number;
    // 整体转化率：所有触点的平均转化率
    totalConversionRate: number;
    // 总贡献度：固定为100%（所有触点贡献度之和）
    totalContribution: number;
  };
  // 使用的归因模型（返回给前端展示）
  attributionModel: AttributionModelEnum;
  // 查询的时间范围（返回给前端展示）
  timeRange: [string, string];
}

/**
 * ClickHouse原始返回行类型
 * 定义从ClickHouse查询返回的原始数据结构，与SQL查询字段一一对应
 */
export interface IAttributionRawRow {
  // 归因事件名称（对应SQL中的$event_name）
  attribution_event_name: string;
  // 动态维度值：键为维度名，值为维度对应的原始查询值
  [dimensionKey: string]: string | number | null;
  // 归因事件总次数（SQL聚合结果）
  total_count: number;
  // 归因事件用户数（SQL聚合结果，uniq($uid)）
  user_count: number;
  // 转化指标值（该触点贡献的转化数）
  conversion_metric: number;
  // 转化率（百分比）
  conversion_rate: number;
  // 贡献度百分比（该触点占总转化的比例）
  contribution_rate: number;
  // 贡献度进度条值（0-100，用于前端进度条展示）
  contribution_progress: number;
}
