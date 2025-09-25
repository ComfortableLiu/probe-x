import React from "react"
import { IFormItem } from "@components/FormComponent/type"
import { FormItemType } from "@components/FormComponent/constants"
import FormComponent from "@components/FormComponent"
import TableComponent from "@components/TableComponent"

function ScmManage() {
  const formItems: IFormItem[] = [{
    key: 'a',
    label: 'A',
    type: FormItemType.TEXT,
  }, {
    key: 'b',
    label: 'B',
    type: FormItemType.TEXT,
  }, {
    key: 'c',
    label: 'C',
    type: FormItemType.TEXT,
  }, {
    key: 'd',
    label: 'D',
    type: FormItemType.TEXT,
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
