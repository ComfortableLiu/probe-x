import React, { useCallback, useEffect, useState } from "react"
import { Button, DatePicker, Form, Space, Switch, TimePicker } from "antd"
import { useDispatch } from "react-redux"
import dayjs from "dayjs"
import customParseFormat from "dayjs/plugin/customParseFormat"
import PageHeader from "@components/PageHeader"
import { useLoading, useModel } from "@/hooks"
import { Dispatch } from "@/store/storeContext"
import { IGeneralConfigState } from "./type"

dayjs.extend(customParseFormat)

function GeneralConfig() {
  const dispatch = useDispatch<Dispatch>()
  const loading = useLoading()
  const { config } = useModel<IGeneralConfigState>('systemConfigGeneralModel')
  const [form] = Form.useForm()
  const [cleanDate, setCleanDate] = useState<dayjs.Dayjs | null>(null)

  useEffect(() => {
    dispatch.systemConfigGeneralModel.getConfig()
  }, [dispatch])

  useEffect(() => {
    form.setFieldsValue({
      enabled: config.enabled,
      dailyTime: dayjs(config.dailyTime, 'HH:mm'),
    })
  }, [config, form])

  const handleSave = useCallback(async () => {
    const values = await form.validateFields()
    await dispatch.systemConfigGeneralModel.saveConfig({
      enabled: values.enabled,
      dailyTime: values.dailyTime.format('HH:mm'),
    })
  }, [dispatch, form])

  const handleCleanNow = useCallback(async () => {
    await dispatch.systemConfigGeneralModel.cleanNow({
      date: cleanDate ? cleanDate.format('YYYY-MM-DD') : undefined,
    })
  }, [dispatch, cleanDate])

  const saving = loading.systemConfigGeneralModel?.saveConfig
  const cleaning = loading.systemConfigGeneralModel?.cleanNow

  return (
    <div>
      <PageHeader
        title="通用设置"
        onRefresh={() => dispatch.systemConfigGeneralModel.getConfig()}
        loading={loading.systemConfigGeneralModel?.getConfig}
      />
      <p>
        全局运行参数。最终数据清洗每天在配置时间自动执行一次，清洗昨天及以前尚未清洗的数据；
        已清洗过的会话不会重复清洗。也可选择日期后立即手动触发，不选日期则补全部欠账。
      </p>
      <Form form={form} layout="vertical" style={{ maxWidth: 480 }}>
        <Form.Item name="enabled" label="每日定时清洗" valuePropName="checked">
          <Switch checkedChildren="开启" unCheckedChildren="关闭" />
        </Form.Item>
        <Form.Item
          name="dailyTime"
          label="每日清洗时间"
          rules={[{ required: true, message: "请选择每日清洗时间" }]}
        >
          <TimePicker format="HH:mm" minuteStep={5} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item>
          <Button type="primary" onClick={handleSave} loading={saving}>
            保存
          </Button>
        </Form.Item>
      </Form>
      <Space>
        <DatePicker
          value={cleanDate}
          onChange={setCleanDate}
          placeholder="选择清洗日期（可选）"
          allowClear
          disabledDate={(d) => d && !d.isBefore(dayjs(), 'day')}
        />
        <Button onClick={handleCleanNow} loading={cleaning}>
          立即清洗
        </Button>
      </Space>
    </div>
  )
}

export default GeneralConfig
