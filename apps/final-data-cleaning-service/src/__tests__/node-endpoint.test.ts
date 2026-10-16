import os from 'node:os'
import { createServer } from 'node:net'
import { healthListenPort, resolveNodeEndpoint } from '../lib/node-endpoint'

const interfaces = (entries: Array<{ address: string; internal: boolean }>) => ({
  test: entries.map(entry => ({ ...entry, family: entry.address.includes(':') ? 'IPv6' : 'IPv4' })),
}) as ReturnType<typeof os.networkInterfaces>

const base = { masterHost: 'master.example', healthHost: '0.0.0.0', healthPort: 10000 }

describe('计算节点地址探测', () => {
  it('显式地址和外部端口优先，同时保留真实监听地址', () => {
    expect(resolveNodeEndpoint({ ...base, advertiseAddress: ' node.example ', advertisePort: '18000' }, {}))
      .toEqual({ nodeAddress: 'node.example', nodePort: 18000, healthHost: '0.0.0.0', healthPort: 10000 })
  })
  it('优先非内部IPv4，其次IPv6，远端总服务没有可用网卡时留空供peer兜底', () => {
    const mixed = interfaces([
      { address: '127.0.0.1', internal: true },
      { address: '2001:db8::8', internal: false },
      { address: '10.0.0.8', internal: false },
    ])
    expect(resolveNodeEndpoint(base, mixed).nodeAddress).toBe('10.0.0.8')
    expect(resolveNodeEndpoint(base, interfaces([{ address: '2001:db8::8', internal: false }])).nodeAddress).toBe('2001:db8::8')
    expect(resolveNodeEndpoint(base, {}).nodeAddress).toBe('')
  })
  it('本机总服务使用回环地址并兼容IPv6监听', () => {
    expect(resolveNodeEndpoint({ ...base, masterHost: 'http://localhost/' }, {}).nodeAddress).toBe('127.0.0.1')
    expect(resolveNodeEndpoint({ ...base, masterHost: '[::1]', healthHost: '::' }, {}).nodeAddress).toBe('::1')
    expect(resolveNodeEndpoint({ ...base, masterHost: '::1', healthHost: '127.0.0.1' }, {}).nodeAddress).toBe('127.0.0.1')
  })
  it('拒绝无效外部端口，允许健康监听端口配置为0', () => {
    expect(healthListenPort('0')).toBe(0)
    expect(healthListenPort(undefined)).toBe(10000)
    for (const value of ['0', '-1', '65536', 'abc', '1.2']) {
      expect(() => resolveNodeEndpoint({ ...base, advertisePort: value }, {})).toThrow('NODE_ADVERTISE_PORT')
    }
    expect(() => healthListenPort('abc')).toThrow('PORT')
  })
  it('端口0绑定成功后上报系统实际分配的端口', async () => {
    const server = createServer()
    try {
      await new Promise<void>((resolve, reject) => {
        server.once('error', reject)
        server.listen(healthListenPort('0'), '127.0.0.1', resolve)
      })
      const address = server.address()
      if (!address || typeof address === 'string') throw new Error('缺少监听地址')
      expect(address.port).toBeGreaterThan(0)
      expect(resolveNodeEndpoint({ ...base, healthHost: address.address, healthPort: address.port }, {}).nodePort).toBe(address.port)
    } finally {
      await new Promise<void>(resolve => server.close(() => resolve()))
    }
  })
})
