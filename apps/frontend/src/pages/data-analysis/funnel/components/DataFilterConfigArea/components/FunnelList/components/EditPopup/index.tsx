import React, { memo, useCallback, useEffect, useState } from "react"
import { IFunnelInfo } from "@probe-x/shared-types/src"
import * as styles from "./styles.module.scss"
import { Input, Modal } from "antd"
import EventItem from "@pages/data-analysis/components/EventItem"

interface IEditPopupProps {
  show: boolean
  index?: number
  funnelInfo: IFunnelInfo | null
  // 修改值
  onChange?: (value: IFunnelInfo, index: number) => void
  onClose: () => void
}

function EditPopup(props: IEditPopupProps) {

  const {
    show,
    index,
    funnelInfo,
    onChange,
    onClose,
  } = props

  const [info, setInfo] = useState<IFunnelInfo | null>()

  useEffect(() => {
    if (show) {
      setInfo(funnelInfo)
    }
  }, [show])

  const handleOk = useCallback(() => {
    onChange(info, index)
  }, [index, info, onChange])

  return (
    <Modal
      destroyOnClose
      title="设置步骤"
      open={show}
      onOk={() => handleOk()}
      onCancel={() => onClose()}
      width={700}
    >
      <div className={styles.container}>
        <div>步骤名称</div>
        <Input
          value={info?.stepName}
          onChange={(e) => {
            setInfo({
              ...info,
              stepName: e.target.value,
            })
          }}
        />
        <div>相关事件</div>
        <EventItem
          showFilter
          singleMode
          showMetric={false}
          key={index}
          eventInfo={info?.eventInfo}
          index={index}
          onChange={(eventInfo) => {
            setInfo({
              ...info,
              eventInfo,
            })
          }}
        />
      </div>
    </Modal>
  )
}

export default memo(EditPopup)
