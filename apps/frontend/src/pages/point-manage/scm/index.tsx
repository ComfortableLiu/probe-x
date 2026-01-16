import React from "react"
import { FormItemType } from "@components/FormComponent/constants"
import { IFormItem } from "@components/FormComponent/type"
import FormComponent from "@components/FormComponent"
import TableComponent from "@components/TableComponent"
import PageHeader from "@components/PageHeader"
import * as styles from "./styles.module.scss"

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
    <div className={styles.container}>
      <PageHeader title="SCM管理" />
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
