import React from "react"
import { IFormItem } from "@components/FormComponent/type"
import { FormItemType } from "@components/FormComponent/constants"
import FormComponent from "@components/FormComponent"
import TableComponent from "@components/TableComponent"
import FormSpm from "@pages/point-manage/spm/components/FormSpm"

function ScmManage() {
  const formItems: IFormItem[] = [{
    label: 'SPM解析',
    key: 'spm',
    type: FormItemType.CUSTOM,
    tooltip: (
      <span>SPM的四个字段含义详见<a href="https://q7s36ilvwz.feishu.cn/docx/Awaqd61SMo47dQx3VvhcpBr5nGe">这里</a></span>
    ),
    customComponent: FormSpm,
  }]

  return (
    <div>
      <h2>SPM管理</h2>
      <FormComponent
        formItems={formItems}
      />
      <TableComponent
        dataSource={[]}
        columns={[]}
        paginationData={{
          total: 0,
          current: 1,
          pageSize: 20,
        }}
      />
    </div>
  )
}

export default ScmManage
