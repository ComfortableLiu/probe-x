import React, { memo, useCallback, useEffect, useMemo, useState } from "react"
import { Form, Input, Modal, Switch, message } from "antd"
import { AnalysisType, DashboardType, ICreateDashboardReq, IUpdateDashboardReq } from "@pages/data-analysis/dashboard-config/type"
import { createDashboard, updateDashboard } from "@pages/data-analysis/dashboard-config/services"
import { useQuery } from "@/hooks"
import { IEventAnalysisReq, IFunnelAnalysisReq, IUserPathAnalysisReq, IAttributionAnalysisReq } from "@probe-x/shared-types/src"

interface ISaveAsDashboardPopupProps {
  analysisType: AnalysisType
  dashboardId?: number // 如果有dashboardId，则为更新模式
  dashboardName?: string // 看板名称（更新模式使用）
  displayChart?: boolean // 是否展示图表（更新模式使用）
  displayTable?: boolean // 是否展示表格（更新模式使用）
  open: boolean
  onClose: () => void
  onSuccess?: () => void
}

function SaveAsDashboardPopup(props: ISaveAsDashboardPopupProps) {
  const {
    analysisType,
    dashboardId,
    dashboardName,
    displayChart,
    displayTable,
    open,
    onClose,
    onSuccess,
  } = props

  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const { timeRange, dashboardId: urlDashboardId, ...currentQuery } = useQuery<any>()

  const isEdit = !!(dashboardId || urlDashboardId)
  const editDashboardId = dashboardId || urlDashboardId

  // 构建完整的查询参数，包含时间范围
  // 时间范围应该保存在配置中，这样编辑看板时可以恢复原始的时间范围
  const fullQueryParams = useMemo(() => {
    return {
      ...currentQuery,
      ...(timeRange ? { timeRange } : {}),
    }
  }, [currentQuery, timeRange])

  useEffect(() => {
    if (!open) return
    form.resetFields()
    if (isEdit) {
      // 更新模式，使用传入的值或默认值
      form.setFieldsValue({
        name: dashboardName || '',
        displayChart: displayChart !== undefined ? displayChart : true,
        displayTable: displayTable !== undefined ? displayTable : true,
      })
    } else {
      // 创建模式
      form.setFieldsValue({
        displayChart: true,
        displayTable: true,
      })
    }
  }, [form, open, isEdit, dashboardName, displayChart, displayTable])

  const handleOk = useCallback(() => {
    form.validateFields()
      .then(() => form.submit())
      .catch(err => {
        console.error(err)
      })
  }, [form])

  const handleClose = useCallback(() => {
    onClose()
  }, [onClose])

  const handleSubmit = useCallback(async (values: any) => {
    if (loading) return
    setLoading(true)

    try {
      // 获取当前页面的查询参数作为配置，包含时间范围
      // 时间范围应该保存在配置中，这样编辑看板时可以恢复原始的时间范围
      const config: any = {}
      
      if (analysisType === AnalysisType.EVENT) {
        config.eventAnalysis = fullQueryParams as IEventAnalysisReq
      } else if (analysisType === AnalysisType.FUNNEL) {
        config.funnelAnalysis = fullQueryParams as IFunnelAnalysisReq
      } else if (analysisType === AnalysisType.USER_PATH) {
        config.userPathAnalysis = fullQueryParams as IUserPathAnalysisReq
      } else if (analysisType === AnalysisType.ATTRIBUTION) {
        config.attributionAnalysis = fullQueryParams as IAttributionAnalysisReq
      }

      if (isEdit && editDashboardId) {
        // 更新模式
        const data: IUpdateDashboardReq = {
          id: editDashboardId,
          name: values.name,
          config,
          displayChart: values.displayChart,
          displayTable: values.displayTable,
        }
        await updateDashboard(data)
        message.success('看板更新成功')
      } else {
        // 创建模式
        const data: ICreateDashboardReq = {
          name: values.name,
          type: DashboardType.PERSONAL, // 默认创建个人看板
          analysisType,
          config,
          displayChart: values.displayChart,
          displayTable: values.displayTable,
        }
        await createDashboard(data)
        message.success('看板创建成功')
      }
      onSuccess?.()
      onClose()
    } catch (error: any) {
      message.error(error?.msg || (isEdit ? '更新失败' : '创建失败'))
    } finally {
      setLoading(false)
    }
  }, [onClose, onSuccess, loading, analysisType, fullQueryParams, isEdit, editDashboardId])

  const getAnalysisTypeText = useCallback(() => {
    const map = {
      [AnalysisType.EVENT]: '事件分析',
      [AnalysisType.FUNNEL]: '漏斗分析',
      [AnalysisType.USER_PATH]: '用户路径分析',
      [AnalysisType.ATTRIBUTION]: '归因分析',
    }
    return map[analysisType] || '分析'
  }, [analysisType])

  return (
    <Modal
      title={isEdit ? `更新看板 - ${getAnalysisTypeText()}` : `保存为看板 - ${getAnalysisTypeText()}`}
      open={open}
      onOk={handleOk}
      onCancel={handleClose}
      confirmLoading={loading}
      width={500}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        disabled={loading}
      >
        <Form.Item
          name="name"
          label="看板名称"
          rules={[{
            required: true,
            message: "请输入看板名称",
          }]}
        >
          <Input placeholder="请输入看板名称" />
        </Form.Item>
        <Form.Item
          name="displayChart"
          label="展示图表"
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>
        <Form.Item
          name="displayTable"
          label="展示表格"
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>
        <Form.Item label="提示">
          <div style={{ color: '#999', fontSize: '12px' }}>
            {isEdit 
              ? `更新当前${getAnalysisTypeText()}的配置到看板，可在首页统一查看。`
              : `将当前${getAnalysisTypeText()}的配置保存为看板，可在首页统一查看。`}
          </div>
        </Form.Item>
      </Form>
    </Modal>
  )
}

export default memo(SaveAsDashboardPopup)
