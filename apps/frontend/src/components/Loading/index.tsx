import React, { useEffect } from 'react'
import NProgress from 'nprogress'
import * as styles from "./styles.module.scss"
import { Spin } from "antd"

function Loading() {
  useEffect((): (() => void) => {
    NProgress.start()
    return () => NProgress.done()
  }, [])

  return (
    <div className={styles.loadingBox} style={{ paddingLeft: 220 }}>
      <Spin fullscreen size="default" style={{ zIndex: 4 }} />
    </div>
  )
}

export default Loading
