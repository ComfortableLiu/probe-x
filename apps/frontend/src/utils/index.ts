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

/**
 * 从文件链接中提取最后一个文件名（兼容各种URL格式）
 * @param fileUrl - 下载链接（HTTP/HTTPS/Blob/Base64）
 * @returns 提取到的文件名（无则返回空字符串）
 */
const extractFileNameFromUrl = (fileUrl: string): string => {
  if (!fileUrl) return ''

  // 处理 Blob URL（blob:xxx/xxx-xxx 格式）
  if (fileUrl.startsWith('blob:')) {
    const blobParts = fileUrl.split('/')
    return blobParts[blobParts.length - 1] || 'blob文件'
  }

  // 处理 Base64 链接（data:xxx;base64,... 格式）
  if (fileUrl.startsWith('data:')) {
    const mimeMatch = fileUrl.match(/data:([^;]+)/)
    if (mimeMatch) {
      const ext = mimeMatch[1].split('/')[1] // 从 MIME 类型提取后缀
      return ext ? `base64文件.${ext}` : 'base64文件'
    }
    return 'base64文件'
  }

  // 处理普通 HTTP/HTTPS URL
  // 移除查询参数（?后）和哈希值（#后）
  const cleanUrl = fileUrl.split('?')[0].split('#')[0]
  if (!cleanUrl) return ''

  // 分割路径，取最后一段非空内容
  const pathParts = cleanUrl.split('/').filter(part => part.trim() !== '')
  const fileNameWithExt = pathParts.pop() || ''

  // 解码 URL 编码字符（兼容中文、特殊符号）
  try {
    return decodeURIComponent(fileNameWithExt)
  } catch (e) {
    return fileNameWithExt
  }
}

/**
 * 兼容所有浏览器的文件下载函数（TS版）
 * @param fileUrl - 下载链接（HTTP/HTTPS/Blob/Base64）
 * @param customFileName - 自定义文件名（可选，优先级高于提取的文件名）
 * @param isLargeFile - 只有IE11才起作用 是否为大文件（>100MB，默认false）
 * @returns Promise<void> - 可捕获下载失败错误
 */
export const downloadFile = async (
  fileUrl: string,
  customFileName?: string,
  isLargeFile: boolean = false,
): Promise<void> => {
  // 优先级：自定义文件名 > URL提取文件名 > 默认文件名
  let fileName = customFileName || extractFileNameFromUrl(fileUrl) || '下载文件'

  // 补全文件名后缀（无后缀时从URL提取）
  const getFullFileName = (): string => {
    if (fileName.includes('.')) return fileName
    const urlExt = fileUrl.split('.').pop()?.split('?')[0]
    return urlExt ? `${fileName}.${urlExt}` : fileName
  }
  const fullFileName = getFullFileName()

  // IE11 特殊处理
  // @ts-ignore
  if (window.navigator.msSaveOrOpenBlob) {
    if (isLargeFile) {
      window.open(fileUrl, '_blank')
      return
    }

    try {
      const response = await fetch(fileUrl, {
        method: 'GET',
        mode: 'cors',
        cache: 'no-cache',
      })

      if (!response.ok) {
        throw new Error(`HTTP请求失败：${response.status} ${response.statusText}`)
      }

      const blob = await response.blob()
      // @ts-ignore
      window.navigator.msSaveOrOpenBlob(blob, fullFileName)
    } catch (err) {
      console.error('IE11下载失败：', err)
      window.open(fileUrl, '_blank') // 降级处理
      throw err // 抛出错误供外部捕获
    }
    return
  }

  // 现代浏览器处理
  const link = document.createElement('a')
  link.href = fileUrl
  link.download = fullFileName
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()

  // 清理DOM（延迟执行，确保点击事件触发）
  setTimeout(() => document.body.removeChild(link), 100)

  // Safari 跨域兼容（单独处理，解决download属性失效问题）
  if (
    /(Safari)/i.test(navigator.userAgent) &&
    !fileUrl.startsWith('blob:') &&
    !fileUrl.startsWith('data:')
  ) {
    try {
      const response = await fetch(fileUrl, { mode: 'cors' })

      if (!response.ok) {
        throw new Error(`Safari跨域下载失败：${response.status}`)
      }

      const blob = await response.blob()
      const blobUrl = URL.createObjectURL(blob)

      // 重新设置a标签href为Blob URL并触发下载
      link.href = blobUrl
      link.click()

      // 释放Blob URL，避免内存泄漏
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
    } catch (err) {
      console.warn('Safari下载降级处理：', err)
      window.open(fileUrl, '_blank')
      throw err
    }
  }
}
