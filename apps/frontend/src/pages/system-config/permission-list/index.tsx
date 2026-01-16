import React, { memo, useEffect, useState } from "react"
import { Button } from "antd"
import { useNavigate } from "react-router-dom"
import { ArrowLeft } from "@icon-park/react"
import { queryPermissionList } from "../role/services"
import { IPermissionOption } from "../role/type"
import PermissionTree from "@/components/PermissionTree"
import * as styles from "./styles.module.scss"
import PageHeader from "@components/PageHeader"

/**
 * 权限列表页面（只读）
 * 展示系统中所有权限的树形结构
 */
function PermissionList() {
  const navigate = useNavigate()
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

  const handleBack = () => {
    navigate('/system-config/role')
  }

  const handleRefresh = () => {
    loadPermissions()
  }

  return (
    <div className={styles.permissionList}>
      <div className={styles.header}>
        <Button
          type="link"
          icon={<ArrowLeft />}
          onClick={handleBack}
          style={{ padding: 0, marginBottom: 16 }}
        >
          返回角色管理
        </Button>
        <PageHeader
          title="权限列表"
          onRefresh={handleRefresh}
          loading={loading}
        />
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

export default memo(PermissionList)
