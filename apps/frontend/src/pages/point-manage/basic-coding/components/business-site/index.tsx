import React, { Fragment, useMemo, useState } from "react"
import TableComponent from "@components/TableComponent"
import EditBusinessSite from "./components/edit"

function BusinessSite() {

  const [showEdit, setShowEdit] = useState(false)

  const columns = useMemo(() => [], [])

  return (
    <Fragment>
      <TableComponent
        dataSource={[]}
        columns={columns}
      />
      <EditBusinessSite
        open={showEdit}
        onClose={() => setShowEdit(false)}
      />
    </Fragment>
  )
}

export default BusinessSite
