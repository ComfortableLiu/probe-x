import React from "react"
import { Link, Navigate, useParams } from "react-router-dom"
import { Result } from "antd"
import { getLegacyGuidePath } from "@pages/guide/catalog"

// 旧页面说明链接统一转到维护中的系统说明，避免出现两套不同的文案。
function Guide() {
  const { pageKey } = useParams<{ pageKey: string }>()
  const path = getLegacyGuidePath(pageKey)

  return path
    ? <Navigate to={path} replace />
    : <Result status="404" title="未找到对应说明" extra={<Link to="/guide">查看系统说明目录</Link>} />
}

export default Guide
