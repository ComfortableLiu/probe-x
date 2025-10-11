import React, { memo, useCallback, useEffect, useMemo } from "react"
import { IEditBusinessSiteProps } from "./type"
import { Form, Input, Modal } from "antd"
import { ICreateBusinessSiteReq, IUpdateBusinessSiteReq } from "@probe-x/shared-types/src"
import { useDispatch } from "react-redux"
import { Dispatch } from "@/store/storeContext"
import { useLoading } from "@/hooks"

function EditBusinessSite(props: IEditBusinessSiteProps) {

  const {
    open,
    businessSiteInfo,
    onClose,
  } = props

  const dispatch = useDispatch<Dispatch>()
  const loading = useLoading()

  const [form] = Form.useForm<ICreateBusinessSiteReq>()

  const isEdit = useMemo(() => !!businessSiteInfo, [businessSiteInfo])
  const pageLoading = useMemo(() => loading.pointManageBasicCodingModel.updateBusiness || loading.pointManageBasicCodingModel.createBusiness, [loading.pointManageBasicCodingModel.createBusiness, loading.pointManageBasicCodingModel.updateBusiness])

  useEffect(() => {
    if (!open) return
    if (!isEdit) {
      form.resetFields()
    } else {
      form.setFieldsValue(businessSiteInfo)
    }
  }, [businessSiteInfo, form, isEdit, open])

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

  const handleSubmit = useCallback(async (value: ICreateBusinessSiteReq | IUpdateBusinessSiteReq) => {
    if (pageLoading) return
    if (isEdit) {
      await dispatch.pointManageBasicCodingModel.updateBusiness(value as IUpdateBusinessSiteReq)
    } else {
      await dispatch.pointManageBasicCodingModel.createBusiness(value as ICreateBusinessSiteReq)
    }
    onClose()
  }, [dispatch.pointManageBasicCodingModel, isEdit, onClose, pageLoading])

  return (
    <Modal
      title={isEdit ? '编辑' : '新增'}
      open={open}
      onOk={() => handleOk()}
      onCancel={handleClose}
      confirmLoading={pageLoading}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        disabled={pageLoading}
        initialValues={{
          code: businessSiteInfo?.code,
        }}
      >
        {isEdit ?
          <Form.Item
            name="code"
            label="业务线/站点编码"
          >
            {businessSiteInfo?.code}
          </Form.Item>
          : null}
        <Form.Item
          required
          label="业务线/站点名称"
          name="name"
          rules={[{
            required: true,
            message: '请输入业务线/站点名称',
          }]}
        >
          <Input />
        </Form.Item>
        <Form.Item
          label="业务线/站点描述"
          name="description"
        >
          <Input.TextArea
            autoSize={{ minRows: 5, maxRows: 5 }}
          />
        </Form.Item>
      </Form>
    </Modal>
  )
}

export default memo(EditBusinessSite)
