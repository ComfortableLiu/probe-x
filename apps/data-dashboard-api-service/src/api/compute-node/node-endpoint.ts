import { isIP } from 'node:net'

/** 上报端口是监听端口；0 和旧协议的缺字段均表示未知。 */
export function reportedNodePort(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 65535
    ? value
    : undefined
}

function normalizeIp(address: string): string | undefined {
  const family = isIP(address)
  if (family === 4) return address
  if (family !== 6) return undefined
  // URL 只用于 IPv6 文本规范化，不发请求；带网卡作用域的地址保留原值。
  let normalized = address
  try {
    normalized = new URL(`http://[${address}]/`).hostname.slice(1, -1)
  } catch {
    return address
  }
  const mapped = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i.exec(normalized)
  if (!mapped) return normalized
  const high = parseInt(mapped[1], 16)
  const low = parseInt(mapped[2], 16)
  return `${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`
}

/**
 * 解析 gRPC getPeer() 的连接来源，只返回 IP，绝不返回出站临时端口。
 * grpc-js 的 IPv6 peer 也可能是无方括号的「IPv6:port」。
 */
export function parsePeerAddress(peer: unknown): string | undefined {
  if (typeof peer !== 'string') return undefined
  const endpoint = peer.trim().replace(/^ipv[46]:/i, '')
  if (!endpoint || endpoint.length > 512) return undefined
  if (endpoint.startsWith('[')) {
    const bracketed = /^\[([^\]]+)\](?::(\d+))?$/.exec(endpoint)
    if (!bracketed || (bracketed[2] && !reportedNodePort(Number(bracketed[2])))) return undefined
    return normalizeIp(bracketed[1])
  }
  const separator = endpoint.lastIndexOf(':')
  if (separator > 0 && /^\d+$/.test(endpoint.slice(separator + 1))) {
    const address = normalizeIp(endpoint.slice(0, separator))
    if (address) return reportedNodePort(Number(endpoint.slice(separator + 1))) ? address : undefined
  }
  return normalizeIp(endpoint)
}
