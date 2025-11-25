import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Modal, Progress } from "antd"
import { downloadFile } from "@/utils"
import { delay } from "@probe-x/shared-utils/src"

interface IDownloadPopupProps {
  show: boolean
  onClose: () => void
  downloadUrl?: string
}

const step = [{
  delay: 1000,
  target: 10,
}, {
  delay: 2000,
  target: 30,
}, {
  delay: 2000,
  target: 40,
}, {
  delay: 2000,
  target: 50,
}, {
  delay: 5000,
  target: 60,
}, {
  delay: 10000,
  target: 80,
}, {
  delay: 10000,
  target: 90,
}, {
  delay: 15000,
  target: 99,
}]

function DownloadPopup(props: IDownloadPopupProps) {

  const {
    show,
    onClose,
    downloadUrl,
  } = props

  const [percent, setPercent] = useState(0)

  const timer = useRef(false)

  // 进度倒计时函数
  const countDown = useCallback(async () => {
    // 按照step设定，进行倒计时
    for (let i = 0; i < step.length; i++) {
      if (!timer.current) break
      await delay(step[i].delay)
      if (!timer.current) break
      setPercent(step[i].target)
      if (step[i].target === 100) {
        timer.current = true
      }
    }
  }, [])

  useEffect(() => {
    if (show) {
      countDown()
    } else {
      timer.current = false
      setPercent(0)
    }
  }, [show])

  useEffect(() => {
    if (downloadUrl) {
      timer.current = false
      setPercent(100)
    }
  }, [downloadUrl])

  // 进行中的任务
  const renderStep = useMemo(() => {
    if (percent === 100) return null
    return (
      <>
        <p>数据正在查询中，请勿关闭或刷新页面</p>
        <p>查询完成后会自动下载数据文件</p>
      </>
    )
  }, [percent])

  // 任务已完成
  const renderFinal = useMemo(() => {
    if (percent < 100) return null
    return (
      <>
        <p>
          查询完成，
          <a
            href="#"
            onClick={() => downloadFile(downloadUrl)}
          >点击这里下载</a>
        </p>
      </>
    )
  }, [downloadUrl, percent])

  return (
    <Modal
      title="数据下载中"
      open={show}
      onCancel={() => onClose()}
      closable={false}
      maskClosable={false}
      okButtonProps={{
        disabled: !downloadUrl,
      }}
      okText="下载"
      onOk={() => downloadFile(downloadUrl)}
    >
      {renderStep}
      {renderFinal}
      <Progress percent={percent} status={percent === 100 ? 'success' : 'active'} />
    </Modal>
  )
}

export default memo(DownloadPopup)
