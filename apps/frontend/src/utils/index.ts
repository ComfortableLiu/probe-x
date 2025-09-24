import { message } from "antd"

export class LoadingToast {
  static loading = false
  static closeFun: Function | null = null

  static createLoading(msg?: string) {
    message.config({
      rtl: false,
    })

    LoadingToast.loading = true
    LoadingToast.closeFun = message.loading(msg || '请稍后...', 0)
  }

  static destory() {
    LoadingToast.loading = false
    setTimeout(() => {
      if (LoadingToast.closeFun) {
        LoadingToast.closeFun()
        LoadingToast.closeFun = null
      }
    }, 50)
  }
}

/**
 * 将content参数内容复制到粘贴板中
 * @param {String} content
 * @return {Promise}
 */
export function clipboard(content: string | number): Promise<void> {
  if (navigator.clipboard && window.isSecureContext) {
    return new Promise((resolve, reject) => {
      navigator.clipboard.writeText(String(content)).then(() => {
        message.success('复制成功')
        resolve()
      }).catch(() => {
        message.error('复制失败')
        reject()
      })
    })
  }
  return new Promise((resolve, reject) => {
    // 动态创建 textarea 标签
    const textarea = document.createElement('textarea') as any
    // 将该 textarea 设为 readonly 防止 iOS 下自动唤起键盘，同时将 textarea 移出可视区域
    textarea.readOnly = 'readonly'
    textarea.style.position = 'absolute'
    textarea.style.left = '-9999px'
    // 将要 copy 的值赋给 textarea 标签的 value 属性
    // 网上有些例子是赋值给innerText,这样也会赋值成功，但是识别不了\r\n的换行符，赋值给value属性就可以
    textarea.value = content
    // 将 textarea 插入到 body 中
    document.body.appendChild(textarea)
    // 选中值并复制
    textarea.select()
    textarea.setSelectionRange(0, textarea.value.length)

    if (document.execCommand('copy')) {
      document.execCommand('Copy')
      message.success('复制成功')
      resolve()
    } else {
      message.error('复制失败')
      reject()
    }
    document.body.removeChild(textarea)
  })
}
