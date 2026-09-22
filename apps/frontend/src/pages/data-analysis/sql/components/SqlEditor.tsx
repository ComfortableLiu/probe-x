import React, { useEffect, useRef } from "react"
import { EditorState } from "@codemirror/state"
import { EditorView, highlightActiveLine, highlightActiveLineGutter, keymap, lineNumbers } from "@codemirror/view"
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands"
import { defaultHighlightStyle, syntaxHighlighting } from "@codemirror/language"
import { autocompletion, completionKeymap } from "@codemirror/autocomplete"
import { sql } from "@codemirror/lang-sql"
import { clickhouseSqlConfig } from "./clickhouse-dialect"

interface ISqlEditorProps {
  value: string
  onChange: (value: string) => void
  onExecute?: () => void
}

function SqlEditor(props: ISqlEditorProps) {

  const {
    value,
    onChange,
    onExecute,
  } = props

  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView>(null)

  // 编辑器只创建一次，用 ref 持有最新回调避免闭包过期
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const onExecuteRef = useRef(onExecute)
  onExecuteRef.current = onExecute

  useEffect(() => {
    if (!containerRef.current) return
    const view = new EditorView({
      state: EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(),
          highlightActiveLine(),
          highlightActiveLineGutter(),
          history(),
          // ClickHouse 方言：关键字 / 函数 / 类型补全
          sql(clickhouseSqlConfig),
          autocompletion(),
          syntaxHighlighting(defaultHighlightStyle),
          keymap.of([
            {
              key: 'Mod-Enter',
              run: () => {
                onExecuteRef.current?.()
                return true
              },
            },
            // completionKeymap 要排在 defaultKeymap 前，方向键/Enter 才能作用于补全列表
            ...completionKeymap,
            ...defaultKeymap,
            ...historyKeymap,
          ]),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              onChangeRef.current(update.state.doc.toString())
            }
          }),
          EditorView.theme({
            '&': {
              border: '1px solid var(--px-color-border-secondary)',
              borderRadius: '6px',
              fontSize: '13px',
            },
            '.cm-content': {
              minHeight: '120px',
            },
            '.cm-tooltip-autocomplete': {
              border: '1px solid var(--px-color-border-secondary)',
              borderRadius: 'var(--px-radius-sm, 4px)',
              boxShadow: 'var(--px-shadow-sm)',
              fontFamily: 'inherit',
              fontSize: '13px',
            },
            '.cm-tooltip-autocomplete > ul > li[aria-selected]': {
              backgroundColor: 'var(--px-color-primary-bg)',
              color: 'var(--px-color-text-primary)',
            },
            '.cm-completionDetail': {
              color: 'var(--px-color-text-tertiary)',
              fontStyle: 'normal',
              marginLeft: '8px',
            },
          }),
        ],
      }),
      parent: containerRef.current,
    })
    viewRef.current = view
    return () => {
      view.destroy()
      viewRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 外部值变化时同步回编辑器
  useEffect(() => {
    const view = viewRef.current
    if (view && value !== view.state.doc.toString()) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: value },
      })
    }
  }, [value])

  return <div ref={containerRef} />
}

export default SqlEditor
