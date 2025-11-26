import { Injectable } from '@nestjs/common'
import { IUserPathAnalysisReq, IUserPathAnalysisRes } from "@probe-x/shared-types/src"
import { ClickHouseService } from "@probe-x/shared-utils/src/lib/backend-common"
import { generateUserPathAnalysisSql } from "@src/api/data-analysis/UserPathAnalysisSqlBuilder"

// 原始边数据类型（适配 ClickHouse 查询结果）
interface OriginalEdge {
  source: string | null;
  target: string;
  value: number;
}

// 拆分后的节点类型
interface SplitNode {
  originalName: string; // 原始节点名
  splitName: string;    // 拆分后节点名（唯一）
  step: number;         // 步骤序号（避免循环）
}

@Injectable()
export class UserPathAnalysisService {
  constructor(
    private readonly clickhouseService: ClickHouseService,
  ) { }

  async queryEvent(data: IUserPathAnalysisReq): Promise<IUserPathAnalysisRes> {
    // 1. 执行 SQL 查询（原始数据，可能含循环）
    const { sql, params, error } = generateUserPathAnalysisSql(data)
    // console.log('SQL语句：', sql)
    // console.log('SQL参数：', params)
    // console.log('SQL错误：', error)

    const originalResult = (await this.clickhouseService.query<any>(sql, params))[0]
    // const originalResult = {
    //   "eventList": ["page_load", "page_view", "button_click", "form_submit", "payment_success", "page_leave", "modal_open", "address_edit"],
    //   "edgeList": [
    //     // 1. 起点数据（source: null 表示 Session 起始）
    //     { "source": null, "target": "page_load", "value": 2856 },
    //
    //     // 2. 核心转化主路径（数值最高，无循环）
    //     { "source": "page_load", "target": "page_view", "value": 2532 },
    //     { "source": "page_view", "target": "button_click", "value": 1876 },
    //     { "source": "button_click", "target": "form_submit", "value": 1423 },
    //     { "source": "form_submit", "target": "payment_success", "value": 987 },
    //     { "source": "payment_success", "target": "page_leave", "value": 856 },
    //
    //     // 3. 双向循环场景（用户往返操作）
    //     { "source": "page_view", "target": "button_click", "value": 1876 },
    //     { "source": "button_click", "target": "page_view", "value": 328 }, // 点击后返回浏览（二次确认）
    //     { "source": "form_submit", "target": "address_edit", "value": 276 },
    //     { "source": "address_edit", "target": "form_submit", "value": 243 }, // 编辑地址后返回提交
    //     { "source": "payment_success", "target": "page_view", "value": 156 }, // 支付成功后继续浏览（复购潜力）
    //     { "source": "page_view", "target": "payment_success", "value": 47 }, // 浏览后直接支付（跳过中间步骤）
    //
    //     // 4. 多层循环场景（多节点往返）
    //     { "source": "page_view", "target": "modal_open", "value": 532 },
    //     { "source": "modal_open", "target": "button_click", "value": 389 },
    //     { "source": "button_click", "target": "modal_open", "value": 127 }, // 点击→打开弹窗→再点击（多层循环）
    //     { "source": "modal_open", "target": "page_view", "value": 98 }, // 弹窗关闭后返回浏览
    //
    //     // 5. 自循环场景（用户重复操作同一事件）
    //     { "source": "button_click", "target": "button_click", "value": 89 }, // 重复点击同一按钮（网络延迟/操作犹豫）
    //     { "source": "address_edit", "target": "address_edit", "value": 56 }, // 重复编辑地址（修改多次）
    //     { "source": "modal_open", "target": "modal_open", "value": 32 }, // 重复打开同一弹窗（误操作）
    //
    //     // 6. 中途退出路径（与循环路径并行）
    //     { "source": "page_view", "target": "page_leave", "value": 628 },
    //     { "source": "button_click", "target": "page_leave", "value": 273 },
    //     { "source": "form_submit", "target": "page_leave", "value": 189 },
    //     { "source": "modal_open", "target": "page_leave", "value": 105 },
    //     { "source": "address_edit", "target": "page_leave", "value": 67 },
    //
    //     // 7. 冷门但合理的循环路径
    //     { "source": "page_load", "target": "modal_open", "value": 76 }, // 加载后直接打开弹窗
    //     { "source": "modal_open", "target": "page_leave", "value": 43 }, // 弹窗打开后直接离开
    //     { "source": "payment_success", "target": "modal_open", "value": 29 }, // 支付成功后打开弹窗（查看优惠）
    //     { "source": "address_edit", "target": "button_click", "value": 23 }, // 编辑地址后返回点击按钮
    //     { "source": "page_load", "target": "page_leave", "value": 48 }, // 加载后直接离开（页面体验差）
    //     { "source": "form_submit", "target": "modal_open", "value": 37 }, // 提交后打开弹窗（确认信息）
    //     { "source": "modal_open", "target": "address_edit", "value": 21 }, // 弹窗打开后编辑地址
    //     { "source": "button_click", "target": "address_edit", "value": 19 }, // 点击按钮后编辑地址
    //     { "source": "address_edit", "target": "page_view", "value": 15 }, // 编辑地址后返回浏览
    //   ],
    // }
    // console.log('原始查询结果：', originalResult)

    // 2. 提取原始数据（适配 ClickHouse 返回格式，确保 eventList 和 edgeList 存在）
    const originalEventList = originalResult?.eventList || []
    const originalEdgeList = (originalResult?.edgeList || []) as OriginalEdge[]

    // 3. 核心：处理循环数据（拆分为无环结构）
    const { splitEventList, splitEdgeList } = this.processCycleData(originalEventList, originalEdgeList)

    // 4. 返回拆分后的无环数据（前端可直接渲染）
    return {
      eventList: splitEventList,
      edgeList: splitEdgeList,
    } as IUserPathAnalysisRes
  }

  /**
   * 处理循环数据：将有环结构拆分为无环（A→B→A 拆为 A_1→B_1→A_2）
   * @param originalEventList 原始事件列表
   * @param originalEdgeList 原始边列表（可能含循环）
   * @returns 无环的 eventList 和 edgeList
   */
  private processCycleData(
    originalEventList: string[],
    originalEdgeList: OriginalEdge[],
  ): { splitEventList: string[], splitEdgeList: any[] } {
    // 存储拆分后的节点（避免重复）
    const splitNodesMap = new Map<string, SplitNode>()
    // 记录每个原始节点的当前步骤序号（用于生成唯一拆分名）
    const nodeStepCounter = new Map<string, number>()
    // 拆分后的边列表
    const splitEdgeList: any[] = []

    // 初始化：添加「起点」节点（处理 source: null）
    const startNode: SplitNode = {
      originalName: '起点',
      splitName: '起点_1',
      step: 1,
    }
    splitNodesMap.set(startNode.splitName, startNode)
    nodeStepCounter.set(startNode.originalName, 1)

    // 初始化原始节点的步骤计数器（从1开始）
    originalEventList.forEach(event => {
      if (!nodeStepCounter.has(event)) {
        nodeStepCounter.set(event, 1)
      }
    })

    // 遍历原始边，拆分循环
    originalEdgeList.forEach(edge => {
      const { source, target, value } = edge
      if (!target || value <= 0) return

      // 4.1 处理源节点（source: null → 映射为「起点」）
      const originalSource = source === null ? '起点' : source
      // 获取源节点当前步骤序号，生成拆分名（如 page_view_1）
      const sourceStep = nodeStepCounter.get(originalSource)!
      const sourceSplitName = `${originalSource}_${sourceStep}`

      // 4.2 处理目标节点
      const originalTarget = target
      // 关键逻辑：如果是循环（源节点=目标节点，或目标节点已在之前的链路中出现过），步骤序号+1
      let targetStep = nodeStepCounter.get(originalTarget)!

      // 判定循环场景：
      const isSelfCycle = originalSource === originalTarget // 自循环（A→A）
      const isReverseCycle = this.checkReverseCycle(originalSource, originalTarget, originalEdgeList) // 双向循环（A→B 且 B→A）

      // 循环场景：目标节点步骤序号+1（生成新节点，避免环）
      if (isSelfCycle || isReverseCycle) {
        targetStep += 1
        nodeStepCounter.set(originalTarget, targetStep)
      }

      // 生成目标节点拆分名（如 page_view_2）
      const targetSplitName = `${originalTarget}_${targetStep}`

      // 4.3 存储拆分后的节点（避免重复添加）
      if (!splitNodesMap.has(sourceSplitName)) {
        splitNodesMap.set(sourceSplitName, {
          originalName: originalSource,
          splitName: sourceSplitName,
          step: sourceStep,
        })
      }
      if (!splitNodesMap.has(targetSplitName)) {
        splitNodesMap.set(targetSplitName, {
          originalName: originalTarget,
          splitName: targetSplitName,
          step: targetStep,
        })
      }

      // 4.4 生成拆分后的边（无环）
      splitEdgeList.push({
        source: sourceSplitName,
        target: targetSplitName,
        value: value,
      })

      // 4.5 更新源节点步骤序号（如果后续有链路从该节点出发，避免重复）
      if (!isSelfCycle) {
        nodeStepCounter.set(originalSource, sourceStep + 1)
      }
    })

    // 4.6 提取拆分后的事件列表（所有拆分节点的 splitName）
    const splitEventList = Array.from(splitNodesMap.values()).map(node => node.splitName)

    return {
      splitEventList,
      splitEdgeList,
    }
  }

  /**
   * 辅助函数：判断是否为双向循环（A→B 且 B→A 同时存在）
   */
  private checkReverseCycle(source: string, target: string, edgeList: OriginalEdge[]): boolean {
    return edgeList.some(
      edge => edge.source === target && edge.target === source,
    )
  }
}
