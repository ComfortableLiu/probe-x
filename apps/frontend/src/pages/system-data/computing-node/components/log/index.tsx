import React from "react"
import { useNavigate, useParams } from "react-router-dom"
import PageHeader from "@components/PageHeader"

interface ComputingNodeLogsParams {
  nodeId: string;
}

const ComputingNodeLogs: React.FC = () => {
  const { nodeId } = useParams<any>()
  const navigate = useNavigate()

  // 返回上一页的处理函数
  const handleBack = () => {
    navigate('/system-data/computingNode')
  }

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ marginBottom: '20px' }}>
        <button
          onClick={handleBack}
          style={{
            padding: '8px 16px',
            backgroundColor: '#e5e7eb',
            border: '1px solid #d1d5db',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          ← 返回计算节点
        </button>
      </div>

      <PageHeader title={`计算节点日志 - 节点ID: ${nodeId}`} />
      <div>
        <p>这里是计算节点 {nodeId} 的详细运行日志。</p>
        <p>当前为占位页面，实际的日志功能将在后续实现。</p>

        {/* 日志内容区域 */}
        <div style={{
          border: '1px solid #ccc',
          padding: '10px',
          height: '400px',
          overflowY: 'auto',
          backgroundColor: '#000',
          color: '#00ff00',
          fontFamily: 'monospace',
          fontSize: '12px',
          borderRadius: '4px',
          marginTop: '10px',
        }}>
          <p>[2023-06-15 10:30:15] INFO: Node {nodeId} started successfully</p>
          <p>[2023-06-15 10:30:16] INFO: Initializing resources...</p>
          <p>[2023-06-15 10:30:17] INFO: Resources initialized</p>
          <p>[2023-06-15 10:30:18] INFO: Node status: Running</p>
          <p>[2023-06-15 10:31:00] DEBUG: Processing task 001</p>
          <p>[2023-06-15 10:31:05] DEBUG: Task 001 completed</p>
          <p>[2023-06-15 10:32:00] DEBUG: Processing task 002</p>
          <p>[2023-06-15 10:32:05] DEBUG: Task 002 completed</p>
          <p>[2023-06-15 10:33:00] INFO: Node status: Running normally</p>
          <p>[2023-06-15 10:34:00] DEBUG: System check passed</p>
          <p>[2023-06-15 10:35:00] INFO: Received new data batch</p>
          <p>[2023-06-15 10:35:05] DEBUG: Processing batch data</p>
          <p>[2023-06-15 10:35:10] DEBUG: Batch processing completed</p>
          <p>[2023-06-15 10:36:00] INFO: Memory usage: 45%</p>
          <p>[2023-06-15 10:36:00] INFO: CPU usage: 32%</p>
          <p>[2023-06-15 10:37:00] DEBUG: Network I/O check</p>
          <p>[2023-06-15 10:37:05] INFO: Network status: Normal</p>
          <p>[2023-06-15 10:38:00] INFO: Node status: Running normally</p>
          <p>[2023-06-15 10:39:00] DEBUG: Disk space check</p>
          <p>[2023-06-15 10:39:05] INFO: Available disk space: 78%</p>
        </div>
      </div>
    </div>
  )
}

export default ComputingNodeLogs
