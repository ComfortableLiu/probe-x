import React, { memo, useCallback, useEffect, useMemo, useState } from "react"
import { Form, Input, Modal, Select, Switch, message } from "antd"
import { useNavigate } from "react-router-dom"
import { IDashboardEditPopupProps } from "./type"
import { IDashboard, AnalysisType, DashboardType, ICreateDashboardReq, IUpdateDashboardReq } from "../../type"
import { createDashboard, updateDashboard } from "../../services"
import { useQuery } from "@/hooks"
import { IEventAnalysisReq, IFunnelAnalysisReq } from "@probe-x/shared-types/src"

function DashboardEditPopup(props: IDashboardEditPopupProps) {
  const {
    dashboard,
    onClose,
    open,
    onSubmit,
  } = props

  const navigate = useNavigate()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const { timeRange, ...currentQuery } = useQuery<any>()

  const isEdit = useMemo(() => !!dashboard, [dashboard])

  useEffect(() => {
    if (!open) return
    if (!isEdit) {
      form.resetFields()
      form.setFieldsValue({
        displayChart: true,
        displayTable: true,
      })
    } else {
      form.setFieldsValue({
        name: dashboard?.name,
        analysisType: dashboard?.analysisType,
        displayChart: dashboard?.displayChart,
        displayTable: dashboard?.displayTable,
      })
    }
  }, [dashboard, form, isEdit, open])

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
      // 获取当前页面的查询参数作为配置
      const config: any = {}
      
      if (values.analysisType === AnalysisType.EVENT) {
        // 从当前页面获取事件分析参数
        config.eventAnalysis = currentQuery as IEventAnalysisReq
      } else if (values.analysisType === AnalysisType.FUNNEL) {
        // 从当前页面获取漏斗分析参数
        config.funnelAnalysis = currentQuery as IFunnelAnalysisReq
      }
      // 其他分析类型类似处理

      if (isEdit && dashboard?.id) {
        const data: IUpdateDashboardReq = {
          id: dashboard.id,
          name: values.name,
          config,
          displayChart: values.displayChart,
          displayTable: values.displayTable,
        }
        const { data: res } = await updateDashboard(data)
        message.success('更新成功')
      } else {
        const data: ICreateDashboardReq = {
          name: values.name,
          type: DashboardType.PERSONAL, // 默认创建个人看板
          analysisType: values.analysisType,
          config,
          displayChart: values.displayChart,
          displayTable: values.displayTable,
        }
        const { data: res } = await createDashboard(data)
        message.success('创建成功')
      }
      await onSubmit()
    } catch (error: any) {
      message.error(error?.msg || (isEdit ? '更新失败' : '创建失败'))
    } finally {
      setLoading(false)
    }
  }, [onClose, onSubmit, loading, isEdit, dashboard, currentQuery])

  const handleSelectAnalysisType = useCallback(() => {
    // 提示用户可以在对应的分析页面配置参数后直接保存为看板
    const analysisType = form.getFieldValue('analysisType')
    if (analysisType && !isEdit) {
      const analysisTypeText = analysisType === AnalysisType.EVENT ? '事件' : 
                               analysisType === AnalysisType.FUNNEL ? '漏斗' : 
                               analysisType === AnalysisType.USER_PATH ? '用户路径' : '归因'
      message.info({
        content: `提示：您也可以在${analysisTypeText}页面配置好参数后，点击页面顶部的"保存为看板"按钮直接创建看板。`,
        duration: 5,
      })
    }
  }, [form, isEdit])

  return (
    <Modal
      title={isEdit ? '编辑看板' : '新增看板'}
      open={open}
      onOk={handleOk}
      onCancel={handleClose}
      confirmLoading={loading}
      width={600}
      destroyOnClose
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
        {!isEdit && (
          <Form.Item
            name="analysisType"
            label="分析类型"
            rules={[{
              required: true,
              message: "请选择分析类型",
            }]}
          >
            <Select
              placeholder="请选择分析类型"
              options={[
                { label: '事件分析', value: AnalysisType.EVENT },
                { label: '漏斗分析', value: AnalysisType.FUNNEL },
                { label: '用户路径分析', value: AnalysisType.USER_PATH },
                { label: '归因分析', value: AnalysisType.ATTRIBUTION },
              ]}
              onChange={handleSelectAnalysisType}
            />
          </Form.Item>
        )}
        {isEdit && (
          <Form.Item label="分析类型">
            <Input value={dashboard?.analysisType} disabled />
          </Form.Item>
        )}
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
        {!isEdit && (
          <Form.Item label="提示">
            <div style={{ color: 'var(--px-color-text-tertiary)', fontSize: '12px' }}>
              提示：创建看板会保存当前分析页面的配置。请先在对应的分析页面配置好参数，再创建看板。
            </div>
          </Form.Item>
        )}
      </Form>
    </Modal>
  )
}

export default memo(DashboardEditPopup)
