import React, { memo, useCallback, useEffect, useMemo } from "react"
import { Button, Col, Form, Row, Space } from "antd"
import { IFormComponentProps, IFormItem } from "./type"
import { FormItemType } from "./constants"
import { useQuery, useRouter } from "@/hooks"
import { IAnyObj } from "@probe-x/shared-types/src/index"
import FormText from "@components/FormComponent/form-item/text"
import * as styles from "./styles.module.scss"
import FormCheckbox from "@components/FormComponent/form-item/checkbox"
import FormCascader from "@components/FormComponent/form-item/cascader"

/**
 * 表单组件
 */
function FormComponent<T extends Object = IAnyObj>(props: IFormComponentProps<T>) {

  const {
    formItems,
    onFinish,
  } = props

  const [form] = Form.useForm<T>()

  const {
    refresh,
  } = useRouter()

  const query = useQuery<T>()

  useEffect(() => {
    form.setFieldsValue(query as any)
  }, [form, query])

  const onHandleFinish = useCallback(async (values: T) => {
    if (onFinish) {
      onFinish(values)
    } else {
      refresh(values, true)
    }
  }, [onFinish, refresh])

  const renderFormItem = useCallback((item: IFormItem) => {
    switch (item.type) {
      case FormItemType.TEXT:
        return <FormText {...item} key={item.key} submit={() => form.submit()} />
      case FormItemType.CHECKBOX:
        return <FormCheckbox {...item} key={item.key} submit={() => form.submit()} />
      case FormItemType.CASCADER:
        return <FormCascader options={item.options} {...item} key={item.key} submit={() => form.submit()} />
      case FormItemType.CUSTOM:
        if (item.customComponent) {
          const CustomComponent = item.customComponent
          return <CustomComponent {...item} key={item.key} />
        }
        return null
      default:
        return null
    }
  }, [form])

  const renderFormItems = useMemo(() => {
    return formItems.map(item => (
      <Col
        key={item.key}
        span={6}
      >
        <Form.Item
          name={item.key}
          label={item.label}
          tooltip={item.tooltip}
        >
          {renderFormItem(item)}
        </Form.Item>
      </Col>
    ))
  }, [formItems, renderFormItem])

  const onReset = () => {
    form.resetFields()
    form.submit()
  }

  return (
    <Form
      className={styles.formGroup}
      form={form}
      onFinish={onHandleFinish}
    >
      <Row
        gutter={[16, 8]}
        style={{ width: '100%' }}
      >
        {renderFormItems}
      </Row>
      <Form.Item
        style={{ width: '100%' }}
      >
        <Space>
          <Button
            type="primary"
            htmlType="submit"
          >
            提交
          </Button>
          <Button
            type="default"
            onClick={onReset}
          >
            重置
          </Button>
        </Space>
      </Form.Item>
    </Form>
  )
}

export default memo(FormComponent)
