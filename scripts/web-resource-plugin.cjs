const { createResourceClient } = require('./service-resource-client.cjs')
const { ServiceResourceMonitor } = require('../libs/shared-utils/src/lib/backend-common/service-resource-monitor.cjs')

class WebResourcePlugin {
  apply(compiler) {
    let monitor
    let client
    const start = () => {
      if (monitor) return
      try {
        client = createResourceClient()
      } catch (error) {
        console.warn(`[Web 资源采样] ${error.message}`)
        return
      }
      monitor = new ServiceResourceMonitor(client, {
        serviceKey: 'frontend',
        onError: error => console.warn(`[Web 资源采样] ${error.message}`),
      })
      monitor.start()
      client.on('ready', () => { void monitor.publish() })
    }
    const stop = async () => {
      await monitor?.stop()
      client?.disconnect()
    }
    // Only long-running dev servers report; a production build is not a Web server.
    compiler.hooks.watchRun.tap('WebResourcePlugin', start)
    compiler.hooks.shutdown.tapPromise('WebResourcePlugin', stop)
    compiler.hooks.watchClose.tap('WebResourcePlugin', () => { void stop() })
  }
}
module.exports = WebResourcePlugin
