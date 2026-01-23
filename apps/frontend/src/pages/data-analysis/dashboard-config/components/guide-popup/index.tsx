import React, { memo, useCallback } from "react"
import { Modal, Button } from "antd"
import { useNavigate } from "react-router-dom"
import { AnalysisType } from "../../type"

interface IGuidePopupProps {
  open: boolean
  onClose: () => void
}

function GuidePopup(props: IGuidePopupProps) {
  const {
    open,
    onClose,
  } = props

  const navigate = useNavigate()

  const handleNavigate = useCallback((analysisType: AnalysisType) => {
    const routeMap: Record<AnalysisType, string> = {
      [AnalysisType.EVENT]: '/data-analysis/event',
      [AnalysisType.FUNNEL]: '/data-analysis/funnel',
      [AnalysisType.USER_PATH]: '/data-analysis/userPath',
      [AnalysisType.ATTRIBUTION]: '/data-analysis/attribution',
    }
    const route = routeMap[analysisType]
    if (route) {
      navigate(route)
      onClose()
    }
  }, [navigate, onClose])

  const getAnalysisTypeText = useCallback((type: AnalysisType) => {
    const map = {
      [AnalysisType.EVENT]: '事件分析',
      [AnalysisType.FUNNEL]: '漏斗分析',
      [AnalysisType.USER_PATH]: '用户路径分析',
      [AnalysisType.ATTRIBUTION]: '归因分析',
    }
    return map[type] || type
  }, [])

  return (
    <Modal
      title="创建看板指引"
      open={open}
      onCancel={onClose}
      footer={null}
      width={600}
    >
      <div style={{ padding: '16px 0' }}>
        <p style={{ marginBottom: 16, color: '#666' }}>
          创建看板需要在对应的数据分析页面配置参数后保存。请选择您要创建的分析类型：
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Button
            type="default"
            block
            onClick={() => handleNavigate(AnalysisType.EVENT)}
          >
            创建事件分析看板
          </Button>
          <Button
            type="default"
            block
            onClick={() => handleNavigate(AnalysisType.FUNNEL)}
          >
            创建漏斗分析看板
          </Button>
          <Button
            type="default"
            block
            onClick={() => handleNavigate(AnalysisType.USER_PATH)}
          >
            创建用户路径分析看板
          </Button>
          <Button
            type="default"
            block
            onClick={() => handleNavigate(AnalysisType.ATTRIBUTION)}
          >
            创建归因分析看板
          </Button>
        </div>
        <div style={{ marginTop: 24, padding: 12, background: '#f0f0f0', borderRadius: 4 }}>
          <div style={{ fontSize: 12, color: '#666', lineHeight: 1.6 }}>
            <p style={{ margin: 0, marginBottom: 8, fontWeight: 'bold' }}>操作提示：</p>
            <ol style={{ margin: 0, paddingLeft: 20 }}>
              <li>点击上方按钮跳转到对应的数据分析页面</li>
              <li>在数据分析页面配置好您的分析参数</li>
              <li>点击页面顶部的"保存为看板"按钮</li>
              <li>填写看板名称和展示选项，完成创建</li>
            </ol>
          </div>
        </div>
      </div>
    </Modal>
  )
}

export default memo(GuidePopup)
