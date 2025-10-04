import React from "react"
import FormComponent from "@components/FormComponent"
import TableComponent from "@components/TableComponent"
import { columns, formItems } from "./config"
import { IMetaEvent } from "@probe-x/shared-types/src"
import { useHistoryListener, useLoading, useModel } from "@/hooks"
import { useDispatch } from "react-redux"
import { Dispatch } from "@/store/storeContext"
import { IPointManageEventState } from "@pages/point-manage/event/type"

function EventManage() {

  const dispatch = useDispatch<Dispatch>()
  const loading = useLoading()

  const {
    eventList,
    pageSize,
    page,
    total,
  } = useModel<IPointManageEventState>('pointManageEventModel')

  useHistoryListener((location) => {
    const { pathname } = location
    if (pathname === '/point-manage/event') {
      dispatch.pointManageEventModel.getEventList()
    }
  })

  return (
    <div>
      <h2>事件管理</h2>
      <FormComponent
        formItems={formItems}
      />
      <TableComponent<IMetaEvent>
        dataSource={eventList}
        columns={columns}
        loading={loading.pointManageEventModel.getEventList}
        paginationData={{
          total: total,
          current: page,
          pageSize: pageSize,
        }}
      />
    </div>
  )
}

export default EventManage
