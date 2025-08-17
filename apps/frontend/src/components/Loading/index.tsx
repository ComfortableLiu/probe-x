import React, { useEffect } from 'react';
import NProgress from 'nprogress';
import * as styles from "./styles.module.scss";
import { Spin } from "antd";

export default () => {

  useEffect((): (() => void) => {
    NProgress.start()
    return () => NProgress.done()
  }, [])

  return (
    <div className={styles.loadingBox} style={{ paddingLeft: 220 }}>
      <Spin size="default" style={{ zIndex: 4 }}/>
    </div>
  )
}
