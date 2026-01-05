import React, { memo } from "react"
import { Upload } from "antd"
import { UploadOutlined } from "@ant-design/icons"
import type { UploadFile, UploadProps } from "antd"
import { IFormUploadProps } from "./type"

function FormUpload(props: IFormUploadProps) {

  const {
    value,
    onChange,
    key,
    disabled,
    style,
    submit,
    action,
    accept,
    maxCount = 1,
    listType = "text",
  } = props

  const handleChange: UploadProps['onChange'] = (info) => {
    const { fileList } = info
    const fileUrlList = fileList
      .filter(file => file.status === 'done')
      .map(file => file.response?.url || file.url)
      .filter(Boolean)
    
    onChange && onChange(maxCount === 1 ? fileUrlList[0] : fileUrlList)
    submit && submit()
  }

  const fileList: UploadFile[] = value 
    ? (Array.isArray(value) ? value : [value]).map((url, index) => ({
        uid: `${index}`,
        name: url.split('/').pop() || `file-${index}`,
        status: 'done',
        url,
      }))
    : []

  return (
    <Upload
      id={key}
      key={key}
      style={{
        ...style,
      }}
      action={action}
      accept={accept}
      fileList={fileList}
      onChange={handleChange}
      disabled={disabled}
      maxCount={maxCount}
      listType={listType}
    >
      <UploadOutlined /> 点击上传
    </Upload>
  )
}

export default memo(FormUpload)

