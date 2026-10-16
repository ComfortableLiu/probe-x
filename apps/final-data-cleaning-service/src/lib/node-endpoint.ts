import os from 'node:os'
import { isIP } from 'node:net'

export interface NodeEndpointOptions {
  masterHost: string
  advertiseAddress?: string
  advertisePort?: string | number
  healthHost: string
  healthPort: number
}

export function healthListenPort(raw: string | undefined, fallback = 10000): number {
  const port = raw === undefined || raw.trim() === '' ? fallback : Number(raw)
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error('PORT 必须是 0–65535 之间的整数')
  }
  return port
}

function masterHostname(raw: string): string {
  const address = raw.replace(/^https?:\/\//i, '').split('/')[0]
  if (address.startsWith('[')) return address.slice(1, address.indexOf(']')).toLowerCase()
  return (isIP(address) ? address : address.split(':')[0]).toLowerCase()
}

function isLoopback(address: string): boolean {
  if (address === 'localhost' || /^127\./.test(address)) return true
  if (isIP(address) !== 6) return false
  try { return new URL(`http://[${address}]/`).hostname === '[::1]' } catch { return false }
}

export function resolveNodeEndpoint(
  options: NodeEndpointOptions,
  interfaces: ReturnType<typeof os.networkInterfaces> = os.networkInterfaces(),
) {
  const explicitAddress = options.advertiseAddress?.trim()
  let nodeAddress = explicitAddress || ''
  if (!nodeAddress) {
    const master = masterHostname(options.masterHost)
    if (isLoopback(master)) {
      nodeAddress = isLoopback(options.healthHost) ? options.healthHost
        : isIP(master) === 6 && isIP(options.healthHost) === 6 ? '::1' : '127.0.0.1'
    } else {
      const addresses = Object.values(interfaces).flatMap(entries => entries || [])
        .filter(entry => !entry.internal && !isLoopback(entry.address) && entry.address !== '0.0.0.0' && entry.address !== '::')
      nodeAddress = addresses.find(entry => isIP(entry.address) === 4)?.address
        || addresses.find(entry => isIP(entry.address.split('%')[0]) === 6)?.address
        || ''
    }
  }
  const configuredPort = options.advertisePort
  const hasExplicitPort = configuredPort !== undefined && String(configuredPort).trim() !== ''
  const nodePort = hasExplicitPort ? Number(configuredPort) : options.healthPort
  if (!Number.isInteger(nodePort) || nodePort < (hasExplicitPort ? 1 : 0) || nodePort > 65535) {
    throw new Error('NODE_ADVERTISE_PORT 必须是 1–65535 之间的整数')
  }
  return { nodeAddress, nodePort, healthHost: options.healthHost, healthPort: options.healthPort }
}
