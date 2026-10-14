/**
 * SDK 信息（sdk.build）测试：浏览器直加载环境无 process，getSDKInfo 不得抛错
 */

import { EventCollector } from '../collector'
import { ConfigManager } from '../config'
import type { ProbeXEvent } from '../types'

const createCollector = (): EventCollector => {
  const config = new ConfigManager({
    apiUrl: 'http://localhost:3000/point/report',
    appId: 'test-app',
    storageType: 'memory',
  })
  return new EventCollector(config)
}

describe('EventCollector SDK 信息', () => {
  test('collectEvent 不抛错，事件 sdk.build 有值', () => {
    const collector = createCollector()
    const event = collector.collectEvent('click')

    expect(event).not.toBeNull()
    expect(event!.sdk.name).toBe('probe-x-web-sdk')
    expect(event!.sdk.build).toBeTruthy()
  })

  test('process 不存在时（模拟浏览器直加载）collectEvent 仍不抛错且 build 回退为 dev', () => {
    const collector = createCollector()
    const g = global as any
    const originalProcess = g.process
    g.process = undefined

    let event: ProbeXEvent | null = null
    try {
      event = collector.collectEvent('click')
    } finally {
      g.process = originalProcess
    }

    expect(event).not.toBeNull()
    expect(event!.sdk.build).toBe('dev')
  })
})
