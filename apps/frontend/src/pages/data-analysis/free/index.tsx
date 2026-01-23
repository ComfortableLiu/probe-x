import React from "react"
import { Button } from "antd"
import { Help } from "@icon-park/react"
import { useNavigate } from "react-router-dom"
import PageHeader from "@components/PageHeader"

function FreeAnalysis() {
  const navigate = useNavigate()

  return (
    <div>
      <PageHeader
        title="自由分析"
        extra={
          <Button
            type="link"
            icon={<Help theme="outline" size="16" fill="#000000" />}
            onClick={() => navigate('/guide/data-analysis/free')}
          >
            说明
          </Button>
        }
      />
    </div>
  )
}

export default FreeAnalysis
