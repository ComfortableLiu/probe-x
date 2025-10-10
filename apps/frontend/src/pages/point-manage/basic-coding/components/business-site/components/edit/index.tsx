import React, { memo, useCallback } from "react"
import TableComponent from "@components/TableComponent"
import { IEditBusinessSiteProps } from "@pages/point-manage/basic-coding/components/business-site/components/edit/type"
import { Modal } from "antd"

function EditBusinessSite(props: IEditBusinessSiteProps) {

  const {
    open,
    onClose,
  } = props

  const handleOk = useCallback(() => {

  }, [])

  const handleClose = useCallback(() => {
    onClose()
  }, [onClose])

  return (
    <Modal
      title="Basic Modal"
      closable={{ 'aria-label': 'Custom Close Button' }}
      open={open}
      onOk={handleOk}
      onCancel={handleClose}
    >
      <TableComponent
        dataSource={[]}
        columns={[]}
      />
    </Modal>
  )
}

export default memo(EditBusinessSite)
