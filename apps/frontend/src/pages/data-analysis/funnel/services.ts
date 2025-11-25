import { IFunnelAnalysisReq } from "@probe-x/shared-types/src"

// 提交数据查询
export async function submitQueryTask(data: IFunnelAnalysisReq) {
  await new Promise((resolve) => {
    setTimeout(() => {
      resolve(true)
    }, 1000)
  })
  return {
    code: 200,
    data: JSON.parse('[{"stepName":"反而个人股","eventInfo":{"eventName":"page_load","metrics":"COUNT"},"value":123},{"stepName":"反而个人股fewfwef","eventInfo":{"eventName":"page_load","metrics":"COUNT"},"value":100},{"stepName":"233333","eventInfo":{"eventName":"page_view","metrics":"COUNT"},"value":50}]'),
    msg: '',
  }
  // return request<IFunnelAnalysisRes>({
  //   url: '/data-analysis/funnel/query',
  //   method: 'post',
  //   data,
  // })
}
