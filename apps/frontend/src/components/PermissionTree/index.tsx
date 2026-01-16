import React, { useMemo } from "react"
import { Empty, Spin, Tree } from "antd"
import type { DataNode, TreeProps } from "antd/es/tree"
import { IPermissionOption } from "@probe-x/shared-types/src"
import * as styles from "./styles.module.scss"

export interface IPermissionTreeProps {
  /** 权限列表数据 */
  permissionList: IPermissionOption[]
  /** 是否显示加载状态 */
  loading?: boolean
  /** 是否可勾选（用于分配权限） */
  checkable?: boolean
  /** 是否显示连接线 */
  showLine?: boolean | { showLeafIcon?: boolean }
  /** 是否可选择 */
  selectable?: boolean
  /** 默认是否展开所有节点 */
  defaultExpandAll?: boolean
  /** 选中的节点（用于受控模式） */
  checkedKeys?: React.Key[] | { checked: React.Key[]; halfChecked: React.Key[] }
  /** 选中节点变化时的回调 */
  onCheck?: (checkedKeys: React.Key[] | { checked: React.Key[]; halfChecked: React.Key[] }) => void
  /** 是否显示权限描述 */
  showDescription?: boolean
  /** 自定义样式类名 */
  className?: string
  /** Tree 组件的其他属性 */
  treeProps?: Omit<TreeProps, 'treeData' | 'checkable' | 'showLine' | 'selectable' | 'defaultExpandAll' | 'checkedKeys' | 'onCheck'>
}

/**
 * 权限树组件
 * 用于展示权限的树形结构，支持只读展示和可勾选两种模式
 */
function PermissionTree(props: IPermissionTreeProps) {
  const {
    permissionList,
    loading = false,
    checkable = false,
    showLine = false,
    selectable = true,
    defaultExpandAll = true,
    checkedKeys,
    onCheck,
    showDescription = false,
    className,
    treeProps,
  } = props

  // 将权限树转换为Tree组件需要的格式
  const treeData = useMemo(() => {
    const convertToTreeData = (permissions: IPermissionOption[]): DataNode[] => {
      return permissions.map(permission => ({
        title: (
          <div className={styles.treeNode}>
            <span
              className={styles.permissionName}
              style={{ fontWeight: permission.level === 1 ? 'bold' : 'normal' }}
            >
              {permission.permissionName}
            </span>
            <span className={styles.permissionKey}>
              ({permission.permissionKey})
            </span>
            {showDescription && permission.description && (
              <span className={styles.permissionDesc}>
                - {permission.description}
              </span>
            )}
          </div>
        ),
        key: permission.id,
        children: permission.children && permission.children.length > 0
          ? convertToTreeData(permission.children)
          : undefined,
      }))
    }
    return convertToTreeData(permissionList)
  }, [permissionList, showDescription])

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <Spin size="large" tip="加载权限列表..." />
      </div>
    )
  }

  if (treeData.length === 0) {
    return (
      <div className={styles.emptyContainer}>
        <Empty description="暂无权限数据" />
      </div>
    )
  }

  return (
    <Tree
      checkable={checkable}
      showLine={showLine}
      selectable={selectable}
      defaultExpandAll={defaultExpandAll}
      treeData={treeData}
      checkedKeys={checkedKeys}
      onCheck={onCheck}
      className={className}
      {...treeProps}
    />
  )
}

export default PermissionTree
