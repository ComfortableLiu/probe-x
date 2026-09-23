import path from 'node:path'
import fs from 'node:fs'

/**
 * 解析 proto 文件路径
 *
 * 打包产物里不能用 import.meta.url：rspack 会把它按「构建机」的绝对路径内联进产物，
 * 换一台机器（比如 Docker）就解析到不存在的目录。这里只用 __dirname / process.cwd()，
 * 并按运行形态依次探测候选路径：
 *
 *   1. <cwd>/proto                                        —— Docker 镜像内（/app/proto）
 *   2. <cwd>/libs/shared-utils/src/lib/backend-common/proto —— 仓库根目录下 yarn dev / yarn test
 *   3. <__dirname>向上若干级后的 proto 目录                  —— dist 布局兜底
 *   4. <cwd>/../libs/shared-utils/src/lib/backend-common/proto —— 子目录启动的兜底
 */
const PROTO_DIR_SEGMENTS = [
  path.join('libs', 'shared-utils', 'src', 'lib', 'backend-common', 'proto'),
  'proto',
]

const collectCandidates = (fileName: string): string[] => {
  const candidates: string[] = []
  const push = (dir: string) => candidates.push(path.resolve(dir, fileName))

  for (const segment of PROTO_DIR_SEGMENTS) {
    push(path.join(process.cwd(), segment))
    push(path.join(process.cwd(), '..', segment))
  }

  // 从当前模块目录逐级上溯，兼容 tsc / rspack 各种产物深度
  let dir = __dirname
  for (let i = 0; i < 6; i++) {
    for (const segment of PROTO_DIR_SEGMENTS) {
      push(path.join(dir, segment))
    }
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }

  return Array.from(new Set(candidates))
}

/**
 * 解析 proto 文件的绝对路径，找不到时抛出带全部候选路径的错误
 * @param protoName proto 文件名（可带可不带 .proto 后缀）
 */
export const resolveProtoPath = (protoName: string): string => {
  const fileName = protoName.endsWith('.proto') ? protoName : `${protoName}.proto`
  const candidates = collectCandidates(fileName)

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) return candidate
    } catch {
      // 目录不可读时继续尝试下一个候选
    }
  }

  throw new Error(
    `找不到 proto 文件 ${fileName}，已尝试以下路径：\n  ${candidates.join('\n  ')}`,
  )
}
