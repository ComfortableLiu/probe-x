import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Input, Select, Tooltip } from "antd"
import { Plus, Help } from "@icon-park/react"
import { useDispatch } from "react-redux"
import { Dispatch } from "@/store/storeContext"
import { useModel, useQuery, useRouter } from "@/hooks"
import {
  IUtmOptionItem,
  IUtmValueFilter,
  UtmDimension,
  UTM_DIMENSIONS,
  UTM_DIMENSION_OPTION_LABEL,
  UtmValueMatchType,
} from "@probe-x/shared-types/src"
import { IDataAnalysisUtmState, IQuery } from "@pages/data-analysis/utm/type"
import { formatUtmValue, buildUtmAliasMap } from "@pages/data-analysis/utm/utils"
import { queryUtmOptions } from "@pages/data-analysis/utm/services"
import * as styles from "./styles.module.scss"

// 匹配方式选项
const MATCH_TYPE_OPTIONS: { label: string, value: UtmValueMatchType }[] = [
  { label: "精确匹配", value: "EXACT" },
  { label: "正则匹配", value: "REGEX" },
]

// 正则匹配问号说明（RE2 语法 + 举例）
const REGEX_HELP = (
  <div style={{ maxWidth: 360 }}>
    <div>支持 ClickHouse RE2 正则，对取值做<b>部分匹配</b>（不要求整串命中，整串匹配请用 ^ 和 $ 锚定）；不支持前瞻、后顾、后向引用。</div>
    <div style={{ marginTop: 8 }}>常用示例：</div>
    <div><code>google|baidu</code> —— 包含 google 或 baidu</div>
    <div><code>^google$</code> —— 精确等于 google</div>
    <div><code>^spring_</code> —— 以 spring_ 开头</div>
    <div><code>_v\d+$</code> —— 以 _v 加数字结尾</div>
    <div><code>^(cpc|cpm)$</code> —— 只命中 cpc 或 cpm</div>
  </div>
)

// 下拉每页条数，与后端默认 pageSize 对齐
const OPTIONS_PAGE_SIZE = 50

// 搜索输入防抖
const SEARCH_DEBOUNCE_MS = 300

interface IRegexInputProps {
  value?: string
  onCommit: (pattern: string) => void
}

/**
 * 正则输入框：本地 state 受控，失焦/回车才提交到 URL
 *
 * 筛选条件存在 URL query 里（useQuery/refresh），若每个按键都走一遍
 * JSON.stringify → queryString → navigate → parse 的回写，受控 Input 的
 * value 会在渲染间隙与 DOM 失同步，光标被重置到末尾；
 * 输入过程只动本地 state，提交点放在失焦/回车（点「查询」按钮也会先触发 blur）
 */
function RegexInput({ value, onCommit }: IRegexInputProps) {
  const [text, setText] = useState(value || '')

  // 外部值变化时同步到本地（URL 分享载入、切换匹配方式清空等）；
  // 输入期间外部值不会变，不会踩正在输入的内容
  useEffect(() => {
    setText(value || '')
  }, [value])

  const commit = useCallback(() => {
    if (text !== (value || '')) {
      onCommit(text)
    }
  }, [text, value, onCommit])

  return (
    <Input
      allowClear
      style={{ minWidth: 360, width: 360 }}
      placeholder="输入正则表达式，如 ^google|baidu"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onPressEnter={commit}
    />
  )
}

interface IValueSelectProps {
  filter: IUtmValueFilter
  onChange: (values: string[]) => void
}

/**
 * 单行取值多选：联网分页加载 + 服务端模糊搜索
 *
 * 每行独立维护自己的 { keyword, page, list, loading, hasMore }，行之间互不干扰；
 * 首次打开下拉才拉第一页，输入关键词 300ms 防抖后回第一页重拉，滚到底追加下一页。
 * 已选中但不在当前列表的值（别的页/别的关键词命中的）合并进 options 保证回显，
 * 别名优先取列表项自身、再回落到 model 条目池（resolve 按需累积），都没有就显示原始值。
 */
function ValueSelect({ filter, onChange }: IValueSelectProps) {

  const dispatch = useDispatch<Dispatch>()

  const {
    utmOptions = [],
  } = useModel<IDataAnalysisUtmState>('dataAnalysisUtmModel')

  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [list, setList] = useState<IUtmOptionItem[]>([])
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  // 是否已成功加载过：下拉首次打开时才发请求
  const [loaded, setLoaded] = useState(false)

  // loading 的同步镜像：onPopupScroll 会连续触发，state 还没落地时靠 ref 挡住并发翻页
  const loadingRef = useRef(false)
  // 请求序号：后发的请求（如搜索重拉）使在途的旧请求结果作废，避免旧关键词的页被追加进新列表
  const requestSeq = useRef(0)
  const searchTimer = useRef<ReturnType<typeof setTimeout>>()

  // 卸载时清掉未触发的防抖
  useEffect(() => () => clearTimeout(searchTimer.current), [])

  // URL 分享进来的选中值不在任何已加载页里，挂载时把它们的别名 resolve 进池
  useEffect(() => {
    if (filter.values?.length) {
      dispatch.dataAnalysisUtmModel.resolveOptions(
        filter.values.map(value => ({ dimension: filter.dimension, value })),
      )
    }
    // 仅挂载时补齐回显；此后 values 的变化都来自本下拉的选择，选项自身已带别名
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 拉取一页；pageNo 为 1 时重置列表（首次打开/搜索重拉），否则追加
  const loadPage = useCallback(async (pageNo: number, searchKeyword: string) => {
    const seq = ++requestSeq.current
    loadingRef.current = true
    setLoading(true)
    try {
      const { data, code } = await queryUtmOptions({
        dimension: filter.dimension,
        keyword: searchKeyword || undefined,
        page: pageNo,
        pageSize: OPTIONS_PAGE_SIZE,
      })
      // 已被更新的请求取代，丢弃旧结果
      if (seq !== requestSeq.current) return
      if (code !== 200 || !data) return
      const items = data.data || []
      setList(prev => pageNo === 1 ? items : [...prev, ...items])
      setPage(pageNo)
      setHasMore(pageNo * (data.pageSize || OPTIONS_PAGE_SIZE) < (data.total || 0))
      setLoaded(true)
    } catch (error) {
      // 请求层已统一 toast 错误信息，这里兜底避免未捕获的 rejection
      console.warn(error)
    } finally {
      if (seq === requestSeq.current) {
        loadingRef.current = false
        setLoading(false)
      }
    }
  }, [filter.dimension])

  // 输入防抖后回第一页重拉（服务端模糊匹配 value/alias）
  const handleSearch = useCallback((value: string) => {
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => {
      setKeyword(value)
      loadPage(1, value)
    }, SEARCH_DEBOUNCE_MS)
  }, [loadPage])

  // 滚到底且还有下一页时追加加载
  const handlePopupScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (loadingRef.current || !hasMore) return
    const target = e.target as HTMLDivElement
    if (target.scrollTop + target.clientHeight >= target.scrollHeight - 16) {
      loadPage(page + 1, keyword)
    }
  }, [hasMore, page, keyword, loadPage])

  // 首次打开才拉第一页，之后重开不重复拉
  const handleDropdownVisibleChange = useCallback((open: boolean) => {
    if (open && !loaded) {
      loadPage(1, '')
    }
  }, [loaded, loadPage])

  // 下拉选项 = 已加载的页 + 已选中但不在列表里的值（回显兜底）
  const options = useMemo(() => {
    const aliasMap = buildUtmAliasMap([...utmOptions, ...list])
    const inList = new Set(list.map(item => item.value))
    const merged = list.map(item => ({
      label: formatUtmValue(item.dimension, item.value, aliasMap),
      value: item.value,
    }))
    ;(filter.values || []).forEach(value => {
      if (inList.has(value)) return
      merged.push({
        label: formatUtmValue(filter.dimension, value, aliasMap),
        value,
      })
    })
    return merged
  }, [utmOptions, list, filter.values, filter.dimension])

  return (
    <Select
      mode="multiple"
      allowClear
      showSearch
      // 关闭本地过滤，搜索走后端 keyword
      filterOption={false}
      loading={loading}
      style={{ minWidth: 360 }}
      placeholder="选择取值，可多选"
      value={filter.values}
      onChange={onChange}
      onSearch={handleSearch}
      onPopupScroll={handlePopupScroll}
      onDropdownVisibleChange={handleDropdownVisibleChange}
      options={options}
    />
  )
}

/**
 * UTM 取值筛选
 *
 * 取值选项来自 UTM 管理维护的条目，下拉里带别名展示（联网分页加载，不再全量预加载）；
 * 已软删的取值压根不出现在选项里，分析侧也会整体排除它们；
 * 正则匹配时用 ClickHouse match() 对该维度的取值做 RE2 部分匹配
 */
function UtmValueFilter() {

  const {
    utmFilters = [],
  } = useQuery<IQuery>()

  const {
    refresh,
  } = useRouter()

  const handleChange = useCallback((value: IUtmValueFilter[]) => {
    refresh({
      utmFilters: value,
    }, true)
  }, [refresh])

  const changeFilter = useCallback((index: number, value: IUtmValueFilter) => {
    const list = [...utmFilters]
    list[index] = value
    handleChange(list)
  }, [utmFilters, handleChange])

  const addFilter = useCallback(() => {
    handleChange([
      ...utmFilters,
      {
        dimension: UTM_DIMENSIONS[0],
        values: [],
        matchType: 'EXACT',
      } as IUtmValueFilter,
    ])
  }, [utmFilters, handleChange])

  const removeFilter = useCallback((index: number) => {
    handleChange(utmFilters.filter((_, i) => i !== index))
  }, [utmFilters, handleChange])

  return (
    <div className={styles.container}>
      {utmFilters.map((filter, index) => (
        <div className={styles.row} key={index}>
          <Select<UtmDimension>
            style={{ width: 220 }}
            placeholder="维度"
            value={filter.dimension}
            // 换维度后取值失效，直接清空，避免旧维度的取值被拼进新维度的条件
            onChange={(value) => changeFilter(index, { dimension: value, values: [], matchType: filter.matchType || 'EXACT' })}
            options={UTM_DIMENSIONS.map((dimension) => ({
              label: UTM_DIMENSION_OPTION_LABEL[dimension],
              value: dimension,
            }))}
          />
          <Select<UtmValueMatchType>
            style={{ width: 110 }}
            value={filter.matchType || 'EXACT'}
            // 切换匹配方式时清空另一种方式的输入，避免脏值被拼进查询条件
            onChange={(value) => changeFilter(index, {
              dimension: filter.dimension,
              values: [],
              matchType: value,
              pattern: undefined,
            })}
            options={MATCH_TYPE_OPTIONS}
          />
          {(filter.matchType || 'EXACT') === 'EXACT' ? (
            // 按维度强制重置：换维度后该行的加载状态（关键词/页码/列表）整体作废
            <ValueSelect
              key={filter.dimension}
              filter={filter}
              onChange={(values) => changeFilter(index, { ...filter, values })}
            />
          ) : (
            <>
              <RegexInput
                value={filter.pattern}
                onCommit={(pattern) => changeFilter(index, { ...filter, pattern })}
              />
              <Tooltip title={REGEX_HELP} placement="topLeft">
                <Help className={styles.helpIcon} theme="outline" size="16" fill="currentColor" />
              </Tooltip>
            </>
          )}
          <a href="#" onClick={(e) => {
            e.preventDefault()
            removeFilter(index)
          }}>
            删除
          </a>
        </div>
      ))}

      <a
        className={styles.addBtn}
        href="#"
        onClick={(e) => {
          e.preventDefault()
          addFilter()
        }}
      >
        <Plus theme="outline" size="14" fill="currentColor" />
        添加 UTM 取值筛选
      </a>
    </div>
  )
}

export default memo(UtmValueFilter)
