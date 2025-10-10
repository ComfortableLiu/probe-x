import React from "react"
import * as styles from "./styles.module.scss"
import BusinessSite from "./components/business-site"

function BasicCodingManage() {

  return (
    <div>
      <h2>基础编码管理</h2>
      <div className={styles.cell}>
        <h3 className={styles.title}>业务线/站点</h3>
        <BusinessSite />
      </div>
    </div>
  )
}

export default BasicCodingManage
