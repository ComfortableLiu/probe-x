import React from 'react'
import { Layout } from 'antd'

const { Footer: AntFooter } = Layout

const Footer: React.FC = () => {
  return (
    <AntFooter style={{
      textAlign: 'center',
      background: '#f0f2f5',
      borderTop: '1px solid #d9d9d9',
      padding: '24px 0',
    }}>
      <div style={{ marginBottom: '16px' }}>
        <span style={{ marginRight: '24px' }}>关于我们</span>
        <span style={{ marginRight: '24px' }}>联系我们</span>
        <span style={{ marginRight: '24px' }}>隐私政策</span>
        <span style={{ marginRight: '24px' }}>服务条款</span>
        <span>帮助中心</span>
      </div>
      <div style={{ color: '#999', fontSize: '14px' }}>
        © 2024 电商Demo平台. 版权所有 | 用于演示Probe-X数据埋点平台
      </div>
    </AntFooter>
  )
}

export default Footer
