## Probe-X 后端服务 & Web SDK Code Review 报告

> 范围：`apps/web-sdk/`、`apps/data-dashboard-api-service/`、`apps/final-data-cleaning-service/`、`apps/preliminary-data-processing-service/`、`apps/receiving-point-service/`  
> 说明：本文件主要记录「不确定是否是 bug / 偏设计层面的可优化点」，已经明显是问题的地方已直接在代码中修复。

---

### 1. Web SDK（apps/web-sdk）

- **1.1 AutoTracker 只通过 `window` 事件分发数据，不直接走 `DataSender` 管道**
  - **位置**：`auto-tracker.ts` 中的 `sendEvent` 方法  
  - **问题/现状**：自动埋点（点击、滚动、表单、性能等）最终是通过：
    - `window.dispatchEvent(new CustomEvent('probe-x-event', { detail: event }));`
    - 并没有复用 `DataSender`，也没有一个默认监听器把这些事件送到后端。
  - **为什么要改/思考点**：
    - 对 SDK 使用者来说，“开箱即用”的预期是：开启 autoTrack 后，这些事件应该自动上报，而不是还要自己写 event listener 再手动发送。
    - 目前的设计更像是一个「事件流导出器」，对初次接入者不太友好。
  - **建议怎么改**：
    - 在 `ProbeX` 构造时，为全局 `window` 注册一个默认的 `probe-x-event` 监听器，自动调用内部的 `DataSender`：
      - 监听到事件后将 `detail` 强类型为 `ProbeXEvent` 或约定好的结构；
      - 统一走 `DataSender.send`，与 `track()` 的行为对齐。
    - 或者在 `AutoTracker` 接收一个 `DataSender` 实例，而不是只拿到 `EventCollector`。
  - **改完的收益/ROI**：
    - **收益**：减少 SDK 接入成本，防止「以为已经自动上报，但其实没有」的误用；统一数据发送路径，方便调试和扩展（如重试、压缩、加密）。
    - **成本**：改动集中在 SDK 内部，接口对外兼容性好，测试工作量中等。
    - **ROI 评估**：中高，尤其是给外部用户用的 SDK，体验提升明显。

- **1.2 AutoTracker 对 `fetch` / `XMLHttpRequest` 的全局 monkey patch 无法还原**
  - **位置**：`auto-tracker.ts` 中的 `trackNetworkRequests()`  
  - **问题/现状**：
    - 覆盖了 `window.fetch` 与 `XMLHttpRequest.prototype.open/send`，但在 `stop()`、`destroy()` 等路径中没有恢复原实现。
    - 一旦开启网络跟踪，对整个页面生命周期都是永久性的 hook。
  - **为什么要改/思考点**：
    - 在复杂项目中，其他库（例如 APM、监控 SDK）也可能对 fetch/XHR 做拦截，现在的实现无法做到「可组合、可撤销」，可能互相影响。
    - 若用户希望在某些时刻关闭网络监控，也无法彻底还原到干净状态。
  - **建议怎么改**：
    - 在 `AutoTracker` 内部保存原始实现：
      - 如 `this.originalFetch`、`this.originalXHROpen`、`this.originalXHRSend`。
    - 在 `stop()` 中：
      - 恢复 `window.fetch = this.originalFetch;`
      - 恢复 `XMLHttpRequest.prototype.open/send` 到原始方法。
  - **改完的收益/ROI**：
    - **收益**：更安全地与其他第三方 SDK 共存；避免调试时出现“看不懂是谁改了 fetch”的情况。
    - **成本**：代码改动较小，但需要补充一些集成测试。
    - **ROI 评估**：中高，尤其是在生产环境会与其他埋点/APM 并存时。

- **1.3 Plugin 类型定义与实际用法不一致**
  - **位置**：
    - 类型：`types.ts` 中 `Plugin.install: (probeX: any, options?: any) => void;`
    - 实现：`plugin-manager.ts` 中 `plugin.install(this, options);`（传入的是 `PluginManager` 实例）
  - **问题/现状**：
    - 类型签名告诉用户 `install` 收到的是 `ProbeX` 实例，但实际上收到的是 `PluginManager`，这会误导自定义插件的开发者。
  - **为什么要改/思考点**：
    - 类型文档即是 API 约定，偏差会导致：
      - 用户在插件里调用不存在于 `PluginManager` 上的方法（比如 `track`），运行时报错。
  - **建议怎么改**：
    - 二选一：
      - 真实按类型来：`PluginManager.register` 改成把 `ProbeX` 实例传入（需要在 `ProbeX` 里把自身引用传下去）；或
      - 按当前实现修正类型：把 `Plugin.install` 的参数改成 `pluginManager: PluginManager`。
  - **改完的收益/ROI**：
    - **收益**：插件作者不容易踩坑，避免运行时错用 API。
    - **成本**：仅类型和少量签名调整，回归测试较少。
    - **ROI 评估**：中等，但属于“趁早修”的问题，后面生态多了就难改。

- **1.4 隐私相关：SessionReplay/Heatmap 捕获 DOM & 文本信息的敏感数据风险**
  - **位置**：`plugin-manager.ts` 中的 `HeatmapPlugin` 与 `SessionReplayPlugin`  
  - **问题/现状**：
    - 热力图插件会记录点击元素的 `textContent`；
    - 会话重放插件会完整记录 `document.documentElement.outerHTML`、变更节点的属性/文本等。
    - 这些数据未与 `ConfigManager.maskSensitiveData` / 白名单/黑名单做任何关联控制。
  - **为什么要改/思考点**：
    - 很容易录到手机号、邮箱、身份证号、聊天内容等个人数据，尤其是输入框 / 动态渲染内容。
    - 与 SDK 已有的隐私配置（`maskSensitiveData` 等）割裂，用户可能误以为“打开了脱敏就安全了”。
  - **建议怎么改**：
    - 至少：
      - 插件在安装时读取 `ConfigManager` 中的隐私配置，默认在开启会话重放/热力图前做一次显式 opt-in。
      - 在序列化 DOM 和 `textContent` 时，对输入框、具有常见敏感字段名的节点做脱敏（如 `password`, `phone`, `email` 等）。
    - 更进一步：
      - 提供元素级别的忽略机制，如 `data-probe-ignore` 属性跳过采集。
  - **改完的收益/ROI**：
    - **收益**：显著降低合规/隐私风险，尤其在对外交付或 SaaS 场景。
    - **成本**：增加少量判断逻辑和配置读取，主要是设计与规范对齐的成本。
    - **ROI 评估**：高，强烈建议优先级靠前。

- **1.5 ConfigManager.reset 简单置空，可能导致后续使用异常**
  - **位置**：`config.ts` 中 `reset()`  
  - **问题/现状**：
    - `reset()` 把 `this.config = {} as ProbeXConfig;`，不再包含任何默认值。
    - 若外部调用 `reset()` 后继续用 SDK，不重新注入完整配置，`get('apiUrl')` 等都会返回 `undefined`，`validate()` 也会全部走错误路径。
  - **为什么要改/思考点**：
    - “重置”语义通常是「回到默认配置」而不是「变成一个空对象」。
  - **建议怎么改**：
    - 持有一份 `defaultConfig`，`reset()` 恢复到 `defaultConfig` 而不是 `{}`。
    - 或在文档中明确说明 `reset` 仅供内部使用，不建议对外暴露；对外用 `update({})`。
  - **改完的收益/ROI**：
    - **收益**：避免某些边缘调用路径（自定义控制台或调试工具）把配置直接“玩坏”。
    - **成本**：较小，主要是多存一份默认配置。
    - **ROI 评估**：中等，偏防御性编码。

---

### 2. 数据仪表板 API 服务（apps/data-dashboard-api-service）

- **2.1 全局 SSO 守卫对健康检查/开放接口的影响**
  - **位置**：`app.module.ts` 中 `APP_GUARD: SsoAuthGuard`  
  - **问题/现状**：
    - 所有路由默认都走 SSO 守卫（`APP_GUARD`），如果后续新增健康检查接口、对外 webhook 等开放入口，需要额外在守卫里做豁免逻辑。
  - **为什么要改/思考点**：
    - 单一全局守卫有利于安全，但也可能让运维接口、内部诊断接口变得难以配置。
  - **建议怎么改**：
    - 在 `SsoAuthGuard` 中：
      - 增加白名单 path 前缀（如 `/api/health`, `/api/public/**`），直接跳过鉴权；
    - 或者：拆成多模块，在某些 module 级别不应用该 guard。
  - **改完的收益/ROI**：
    - **收益**：让健康检查、调试接口更易维护，不用每加一个接口就写一堆自定义逻辑。
    - **成本**：修改守卫逻辑 + 补文档，代码变更不大。
    - **ROI 评估**：视当前是否已经有相应接口而定，中等。

- **2.2 BullMQ 默认 `removeOnComplete` / `removeOnFail` 为 `false` 的堆积风险**
  - **位置**：`app.module.ts` 中 `BullModule.forRootAsync` 默认配置  
  - **问题/现状**：
    - 任务完成和失败都会保留（`removeOnComplete: false`, `removeOnFail: false`）。
    - 对于高吞吐场景，长期运行可能会让 Redis 中任务记录堆积很多。
  - **为什么要改/思考点**：
    - 开发/调试环境保留任务方便排查，但生产一般希望保留有限数量或按 TTL 清理。
  - **建议怎么改**：
    - 根据环境：
      - `NODE_ENV=production` 时使用：
        - `removeOnComplete: { age: 3600, count: 1000 }`
        - `removeOnFail: { age: 24 * 3600, count: 1000 }`
      - 开发环境可继续保留更多。
  - **改完的收益/ROI**：
    - **收益**：避免 Redis 无限制膨胀，减少运维成本。
    - **成本**：配置改动极小。
    - **ROI 评估**：高（成本低，长期收益明显）。

---

### 3. 最终数据清洗服务（apps/final-data-cleaning-service）

- **3.1 `ComputeNodeService` 生命周期与错误处理**
  - **位置**：`main.ts` 中通过 `app.get(ComputeNodeService)` 使用  
  - **问题/现状**：
    - 启动后只是在控制台输出 `nodeService.nodeId`，对 service 的失败/重试/断线逻辑不明确（代码未展示）。
    - 如果该服务节点在运行中崩溃/连接下游失败，是否有集中监控/告警路径不清晰。
  - **为什么要改/思考点**：
    - 作为 gRPC 计算节点，通常需要对「任务拉取不到/与上游断连」做更明确的日志和指标采集。
  - **建议怎么改**（仅建议方向）：
    - 在 `ComputeNodeService` 内增加：
      - 关键状态变更的日志；
      - 暴露 Prometheus 指标或上报至现有监控体系；
    - 在 `main.ts` 中，对 `app.listen()` 的错误做一次兜底 `try/catch`，打印更明确的错误信息。
  - **改完的收益/ROI**：
    - **收益**：错误定位更容易，对分布式节点问题排查友好。
    - **成本**：主要是监控埋点和文档说明。
    - **ROI 评估**：中等，看当前运行稳定性要求。

---

### 4. 初步数据处理服务（apps/preliminary-data-processing-service）

- **4.1 Kafka 配置加载的健壮性**
  - **位置**：`main.ts` 中 `configService.get('kafka.*', default)`  
  - **问题/现状**：
    - 已修复 `clientId` 和 `groupId` 默认值（避免误用 broker 字符串），但整体上若配置缺失仍可能启动成功但连接失败。
  - **为什么要改/思考点**：
    - 启动时配置错误最好能「快速失败」，而不是进入一个“启动成功但实际上没在消费”的状态。
  - **建议怎么改**：
    - 在 bootstrap 中：
      - 检查 `kafka.brokers` 非空，若为默认值且环境非本地，直接抛错终止启动；
      - 日志中明确打印当前使用的 Kafka 配置（masked 形式）。
  - **改完的收益/ROI**：
    - **收益**：减少“配错 Kafka 但没意识到”的隐性故障。
    - **成本**：少量 if/校验代码。
    - **ROI 评估**：中等偏高。

- **4.2 Kafka 消费者的重试 / 死信队列策略（仅作为设计建议）**
  - **问题/现状**：
    - 从 `main.ts` 看，只是启动了 Kafka 微服务，具体消费逻辑与异常处理看不到（可能在 module/service 中）。
  - **建议怎么改**：
    - 在实际消费 handler 中，设计：
      - 幂等处理（基于 message key/id）；
      - 明确的重试次数和死信主题；
      - 对业务不可恢复错误进行告警。
  - **ROI 评估**：
    - 高，但实现成本也相对高，属于系统性工程，不在当前小改范围内，建议列入后续架构演进计划。

---

### 5. 埋点接收服务（apps/receiving-point-service）

- **5.1 全局 SSO 守卫对数据上报接口的影响**
  - **位置**：`app.module.ts` 中 `APP_GUARD: SsoAuthGuard` + `PointModule`  
  - **问题/现状**：
    - 如果埋点上报接口也默认走 SSO 鉴权，第三方前端（如 H5、第三方网站）的接入会很困难，需要额外 token 或 SSO 环境支持。
  - **为什么要改/思考点**：
    - 通常埋点上报接口采用的是另一套鉴权方式（如 appId + 签名、防刷策略），而不是用户 SSO。
  - **建议怎么改**：
    - 为埋点上报路径（如 `/api/point/report`）在 `SsoAuthGuard` 里做白名单豁免，只用签名/频控保护。
    - 或将埋点接口挪到一个不套用该 guard 的 module 中。
  - **改完的收益/ROI**：
    - **收益**：对外埋点 SDK 的接入更通用，不强依赖 SSO 体系。
    - **成本**：少量守卫逻辑调整。
    - **ROI 评估**：高（直接决定了埋点系统对外可用性）。

- **5.2 ClickHouse / Kafka 出错时的降级策略**
  - **位置**：`ClickHouseModule`, `KafkaModule` 集成（细节在 shared-utils）  
  - **问题/现状**：
    - 若 ClickHouse 不可用，当前服务是直接失败请求、还是写入缓冲（如 Redis/本地队列）？从这里看不出来。
  - **建议怎么改**（设计层面）：
    - 制订统一策略：写失败时是否允许写入延迟队列、重试次数、告警阈值等。
  - **ROI 评估**：
    - 中高，属于体系级设计，不适合在本次小范围改动中直接动代码，但建议在后续架构文档中补上。

---

### 6. 通用建议

- **6.1 统一版本号管理（SDK 与服务侧）**
  - Web SDK 中有多处硬编码版本号（如 `2.0.0`），服务侧若也有对应版本判断，建议：
    - 使用构建时注入（如 `process.env.BUILD_VERSION`）统一填充；
    - 在日志和上报字段中统一命名（如 `sdkVersion` / `serviceVersion`）。

- **6.2 指标与日志标准化**
  - 建议为每个服务定义：
    - 统一的请求日志格式（traceId、userId、appId 等）；
    - 关键业务路径的指标（如埋点 QPS、落库成功率、Kafka lag）。

---

如需，我可以按上述每一条建议给出更具体的代码示例（比如 AutoTracker 网络 hook 的可撤销实现、Plugin 接口的重构方案、SSO Guard 的白名单实现等），以及针对某个服务单独再做一轮更深入的架构级 review。 


