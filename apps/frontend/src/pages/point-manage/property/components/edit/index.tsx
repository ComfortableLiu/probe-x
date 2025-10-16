import React, { memo, useCallback, useEffect, useMemo } from "react"
import { Form, Input, Modal, Select } from "antd"
import { IPropertyEditPopupProps } from "./type"
import { useLoading } from "@/hooks"
import { IPropertyListItem } from "@pages/point-manage/property/type"
import { MetaPropertyBusinessType, MetaPropertyType } from "@probe-x/shared-types/src"

function PropertyEditPopup(props: IPropertyEditPopupProps) {

  const {
    property,
    onClose,
    open,
    onSubmit,
  } = props

  const [form] = Form.useForm()
  const loading = useLoading()

  const isEdit = useMemo(() => !!property, [property])

  useEffect(() => {
    if (!open) return
    if (!isEdit) {
      form.resetFields()
    } else {
      form.setFieldsValue(property)
    }
  }, [property, form, isEdit, open])

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

  const handleSubmit = useCallback(async (property: IPropertyListItem) => {
    if (loading.pointManagePropertyModel.createProperty) return
    await onSubmit(property)
    onClose()
  }, [onClose, onSubmit, loading])

  return (
    <Modal
      title={isEdit ? '编辑' : '新增'}
      open={open}
      onOk={() => handleOk()}
      onCancel={handleClose}
      confirmLoading={loading.pointManagePropertyModel.createProperty}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        disabled={loading.pointManagePropertyModel.createProperty}
        initialValues={{
          propertyName: property?.propertyName || '',
        }}
      >
        <Form.Item
          name="propertyName"
          label="属性名"
          rules={[{
            required: true,
            message: "请输入属性名",
          }]}
        >
          <Input disabled={isEdit} />
        </Form.Item>
        <Form.Item
          required
          label="类型"
          name="propertyType"
          rules={[{
            required: true,
            message: "请选择属性",
          }]}
        >
          <Select
            options={[{
              title: '字符串',
              value: MetaPropertyType.STRING,
            }, {
              title: '布尔',
              value: MetaPropertyType.BOOLEAN,
            }, {
              title: '数值',
              value: MetaPropertyType.NUMBER,
            }, {
              title: '日期时间',
              value: MetaPropertyType.DATE,
            }]}
            disabled={isEdit}
          />
        </Form.Item>

        <Form.Item
          required
          label="属性业务类型"
          name="type"
          rules={[{
            required: true,
            message: "请选择属性业务类型",
          }]}
        >
          <Select
            options={[{
              title: '业务属性',
              value: MetaPropertyBusinessType.BUSINESS,
            }, {
              title: '公共属性',
              value: MetaPropertyBusinessType.COMMON,
            }]}
            disabled={isEdit}
          />
        </Form.Item>

        <Form.Item
          label="属性说明"
          name="eventPropertyRemark"
        >
          <Input.TextArea
            autoSize={{ minRows: 5, maxRows: 5 }}
          />
        </Form.Item>
      </Form>
    </Modal>
  )
}

export default memo(PropertyEditPopup)
