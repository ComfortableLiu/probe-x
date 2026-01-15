import React, { memo, useEffect, useState } from "react"
import { queryPermissionList } from "../../services"
import { IPermissionOption } from "../../type"
import PermissionTree from "@/components/PermissionTree"
import * as styles from "./styles.module.scss"

/**
 * 权限树形展示组件（只读）
 * 用于在角色管理页面展示所有权限的树形结构
 * @deprecated 此组件已不再使用，请使用 PermissionTree 公共组件
 */
function PermissionTreeView() {
  const [permissionList, setPermissionList] = useState<IPermissionOption[]>([])
  const [loading, setLoading] = useState(false)

  const loadPermissions = async () => {
    setLoading(true)
    try {
      const { data } = await queryPermissionList()
      setPermissionList(data.data || [])
    } catch (error) {
      console.error('获取权限列表失败:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPermissions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className={styles.permissionTreeView}>
      <div className={styles.header}>
        <h3>系统权限列表</h3>
        <p className={styles.description}>
          展示系统中所有权限的树形结构，按层级组织（页面 {'->'} 功能 {'->'} 子功能）。此页面为只读，如需修改权限请前往权限管理页面。
        </p>
      </div>
      <div className={styles.treeContainer}>
        <PermissionTree
          permissionList={permissionList}
          loading={loading}
          showLine
          defaultExpandAll
          selectable={false}
          showDescription
        />
      </div>
    </div>
  )
}

export default memo(PermissionTreeView)
