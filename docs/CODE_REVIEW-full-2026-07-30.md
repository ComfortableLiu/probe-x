# Probe-X 全面 Code Review 报告

**日期**: 2026-07-30
**审查范围**: 全部 7 个应用 + 2 个共享库 + 工程配置（Docker/nginx/scripts/env），含工作区未提交改动
**审查方式**: 7 个并行分区人工评审 + 自动化检查（ESLint / Jest），所有问题均经逐行代码确认
**历史对照**: `docs/CODE_REVIEW_FIX_REPORT.md`（2026-05-05）、`docs/CODE_REVIEW-backend-and-sdk.md`

---

## 〇、自动化检查结果

- **ESLint**（`yarn lint`，4 个有 lint target 的项目）：shared-types / shared-utils 通过；**ecommerce-demo 失败**（4 error / 2 warning，均为未提交改动引入）：
  - `SearchResultsPage.tsx:178` react/no-unescaped-entities ×2
  - `UserProfilePage.tsx:131,138` react/jsx-key ×2
  - `CheckoutPage.tsx:31`、`OrderDetailPage.tsx:35` react-hooks/exhaustive-deps（warning）
- **Jest**（`yarn nx test web-sdk`）：**未能运行**。`apps/web-sdk/jest.config.js:1` 报 `ReferenceError: module is not defined in ES module scope`——`apps/web-sdk/package.json` 声明了 `"type": "module"`，而 jest.config.js 使用 CommonJS 语法。测试套件当前完全失效，需改名为 `jest.config.cjs` 或改写为 ESM。

## 一、P0 问题汇总（须立即处理）

| # | 位置 | 问题 |
|---|------|------|
| 1 | `scripts/clean-db.js:7-13`、`scripts/setup-metadata.js:31-41` | 远程生产数据库地址 `123.56.201.124:6100` + root 凭据硬编码并提交进 git；clean-db 全表 TRUNCATE 无确认 |
| 2 | `scripts/setup-metadata.js:56-59,266` | 脚本直连 DB 清空 admin 密码 + 用硬编码 SALT/HMAC_SECRET 伪造登录，等于把完整鉴权绕过路径提交进仓库 |
| 3 | `apps/data-dashboard-api-service/src/api/user/JwtStrategy.ts:28-30` | JWT 签发用 `userId`、校验读 `payload.sub`（恒 undefined），叠加 TypeORM 跳过 undefined 条件：任何登录用户可读取/篡改首行用户（admin）资料、拿到全量角色权限 |
| 4 | `apps/web-sdk/src/auto-tracker.ts:985-988` [历史复发] | 全部自动埋点事件只 dispatch CustomEvent，无监听器接入 DataSender——autoTrack 开启后**从不上报任何数据** |
| 5 | `apps/frontend/src/pages/account/login/index.tsx:29-30` | 开放重定向：`redirectUri` 取自 URL query 未校验，登录后可被导向任意恶意站点 |
| 6 | `libs/shared-utils/.../signature.interceptor.ts:69` | `SIGNATURE_SECRET` 未配置时静默退化为空字符串，HMAC 用空 key，签名机制即被绕过（当前唯一使用方把路由全放白名单，暂未可利用，属地雷） |

**P0-1/2 处置要求**：轮换数据库 root 密码与 SALT/HMAC_SECRET，清理 git 历史中的凭据。

## 二、web-sdk（apps/web-sdk）

> 测试目录的未提交 diff 为纯格式化（去分号、尾逗号），无逻辑变更，可放心提交。

### P0
- **auto-tracker.ts:985-988 [历史复发]**：所有自动埋点（click/scroll/form/error/page_view/heartbeat/network）只 `window.dispatchEvent(new CustomEvent('probe-x-event'))`，全 SDK 无监听器转发给 DataSender（仅测试文件监听），autoTrack 事件永远不到服务端。历史文档 1.1 至今未修。**修复时必须先做下一条的自请求过滤，否则立即形成无限自激上报循环。**

### P1
- **auto-tracker.ts:504,543,548 [历史复发]**：fetch/XHR monkey patch 在 stop()/destroy() 中不还原，永久残留。
- **auto-tracker.ts:504-578 vs sender.ts:268-302**：patch 后的 fetch/XHR 不排除 SDK 自身上报请求，每次上报都会再产生 network_request 事件。
- **collector.ts:265,282 vs session-manager.ts:83,104,119**：会话存储 key 两边不一致（`session_time`/`session_start_time`、`session_event_count`/`session_events`），导致上报的 `session.duration` ≈ 0、事件数恒为 1，属静默数据错误。
- **performance-monitor.ts:10-154,532-535**：6 个 PerformanceObserver 均为局部变量，`destroy()` 的 disconnect 是空操作，观察者永不停止。
- **performance-monitor.ts:133**：`resourceTimings` 只增不减，SPA 长会话无界内存增长。
- **plugin-manager.ts:311-332,470-484**：Heatmap/SessionReplay 用匿名函数注册监听，stop 只置标志位（注释谎称"会自动清理"），监听器全部残留。
- **plugin-manager.ts:494-544 [历史复发]**：SessionReplay 记录 outerHTML/textContent/输入框 value（含密码框），不读 `maskSensitiveData` 配置，且 `replayData`/`heatmapData` 无界增长。
- **auto-tracker.ts:658, plugin-manager.ts:460**：`MutationObserver.observe(document.body)` 未判空，`<head>` 中初始化时抛错并使 SDK 处于半初始化状态。
- **index.ts:252-355 / session-manager.ts:148-252**：destroy() 不移除任何全局监听（beforeunload/pagehide/visibilitychange/5 个 activity 监听均为匿名闭包），SDK 实例无法 GC。
- **sender.ts:69-73,589-598**：重试 setTimeout 未保存 id，destroy 后仍触发并重发事件。
- **sender.ts:479-484, collector.ts:256-285**：localStorage 访问无 try/catch（deviceId 与 4 个 session getter），隐私模式下整批发送失败或事件静默丢失。index/session-manager 已做防护，这两处是漏网之鱼。

### P2
- **sender.ts:245-265**：sendBeacon 被当作常规发送首选通道，成功即返回伪造的 `{ok:true,status:200}`，服务端 4xx/5xx 不可见，重试机制失效。beacon 应仅用于卸载场景。
- **sender.ts:140-152**：flushSync gif 降级在 URL 压缩后仍 >2000 时无最小化兜底，事件静默丢失。
- **index.ts:252-253, auto-tracker.ts:385-386**：beforeunload + pagehide 双挂，桌面导航时 page_stay/page_unload 重复采集。
- **index.ts:71-77 vs auto-tracker.ts:155-192**：page_view 三重来源（init 手动 + load + visibilitychange 变可见），语义与 page_show 重叠。
- **session-manager.ts:178-185**：心跳硬编码 60000ms，忽略配置 `heartbeatInterval`（默认 30000）。
- **session-manager.ts:148-172**：mousemove/scroll/keydown 每次同步写 localStorage，无节流。
- **collector.ts:424-437**：每个事件把整条数组（maxSize=1000 含全量 rawData）parse→push→stringify 重写，O(n) 写放大，易触 5MB 配额丢数据。
- **index.ts:28,194-214**：`generateSessionId()` 与 SessionManager 逻辑重复、key 绕过 storagePrefix，且生成的 sessionId 字段无消费者，死代码。
- **index.ts:219-233 vs sender.ts:477-512**：deviceId 两套生成逻辑（uuid vs canvas 指纹），自定义 storagePrefix 后 key 分叉，同一设备两个 ID。
- **plugin-manager.ts:199-211,149-153**：`beforeTrack` 钩子全 SDK 无人触发，ABTestPlugin 不生效；且 hook `return true` 会被当作新 data 污染管道。
- **sender.ts:589-597**：destroy() 在 isSending 时 flush 直接 return 后 clearQueue，丢失整批在途+排队事件。

### P3
- **sender.ts:234**：字段名 `zoon` 为 `zoom` 笔误，已上报后端。
- **collector.ts:371-388**：脱敏用子串匹配误伤 `keyboard`/`monkey`，且不递归嵌套对象。
- **config.ts:74,131-136**：构造与 update() 均为浅合并。
- **config.ts:148-210**：`validate()` 无调用点，非法配置运行期不报错。
- **config.ts:141-143 [历史复发]**：`reset()` 置 `{}` 而非恢复默认值（历史 1.5）。
- **index.d.ts:107-174**：声明文件过期（public/private 不符、缺大量字段），与 types.ts 脱节。
- **__tests__/index.test.ts:107-113,129-135**：断言写在 setTimeout 回调里未 await，断言失败不会使测试失败，两个用例形同虚设。

### 总体评价
模块划分清晰，多通道降级（beacon→fetch→XHR→gif）思路合理，但核心断链未修：autoTrack 实际不上报数据（上轮已指出）。资源治理是第二短板——patch 不可还原、observer/listener 普遍不清理、多处无界数组，destroy 语义基本失效。修复顺序建议：先修 P0 上报链路（含自请求过滤），再系统补 destroy 清理。

## 三、共享库（libs/shared-types、libs/shared-utils）

> 未提交 diff 仅为删除行尾空白，无逻辑变化。

### P0
- **signature.interceptor.ts:69**：`SIGNATURE_SECRET || ''` 空密钥回退（见 P0 汇总 #6）。应启动 fail-fast。

### P1
- **sso-auth-guard.activate.ts:41-45**：`verifyAsync` 只验签不校验 `payload.tokenType`，refresh token（7 天）可直接当 access token 调所有业务接口；access token 也可无限刷新续期。
- **exception.filter.ts:42-50**：`BusinessException` 分支丢弃 `exception.code`（响应恒 -1）；`QueryFailedError` 判断是死代码（TypeORM 错误不是 BusinessException 实例）。
- **redis.service.ts:45**：`once('ready')` 置 isConnected，断线重连后永远停在 false，三个事件日志判断全部失真。
- **minio.service.ts:37-41**：构造函数 fire-and-forget `ensureBucketExists().catch(() => { throw })`，catch 内 throw 变 unhandledRejection，Node 15+ 直接 crash 进程。应移到 onModuleInit 并 await。
- **redis.module.ts:20 + redis.service.ts:15-26**：module 层 retryStrategy 覆盖 service 内置"重试 10 次停止"逻辑，注释与实际行为相反。

### P2
- **signature.interceptor.ts:36,50**：nonce 无唯一性校验/存储，5 分钟窗口内可无限重放。应 Redis `SET NX EX 300`。
- **signature.interceptor.ts:20-23**：唯一注册方 receiving-point-service 把全部路由放白名单，拦截器保护 0 个路由，死安全控制。
- **env-config.module.ts:11**：`sourceRoot` 硬编码 `apps/data-dashboard-api-service`，其他服务源码运行时会读错 env 文件。
- **kafka.module.ts:16,20**：clientId/groupId 默认值是 `'localhost:9092'`（broker 地址复制粘贴错误）。
- **clickhouse.provider.ts:20**：`max_open_connections` 读错配置键（`clickhouse.connectionTimeout`），缺省时连接池上限变 10000。

### P3
- **json-body.interceptor.ts:14,20**：无 app 开启 rawBody，拦截器是死代码；解析失败抛普通 Error 变 500 而非 400。
- **exception.filter.ts:39,52**：HttpException 被 console.error 记录两次。
- **signature.interceptor.ts:126**：body 传入的 signature 可为任意 JSON 类型，`Buffer.from(123)` 抛 TypeError 变 500。
- **user.decorator.ts:8**：`@User()` 类型 `keyof IUser` 与 JWT 实际 payload 不符，且暴露 passwordHash 语义。应定义 ITokenPayload。
- **shared-types redis/index.ts:19**：`IUserCacheData.updatedAt: Date` 经 JSON 序列化后实为 string。
- **minio.service.ts:22,80**：过期时间配置键不一致（`DOWNLOAD_EXPIRES` vs `minio.downloadExpires`），前者无效。
- **mysql.module.ts:32-34,59**：静态模块元数据被 forRoot 动态模块完全覆盖，误导性死配置。

### 总体评价
历史 `noSignature` 后门确认已修复未复发。主要风险：SsoAuthGuard 不区分 token 类型是最实质鉴权缺陷；SignatureInterceptor 空密钥回退 + nonce 可重放 + 保护 0 路由，整套机制"装了没通电"；RedisService 连接状态机自相矛盾。

## 四、data-dashboard-api-service

### P0
- **JwtStrategy.ts:28-30 + auth.service.ts:24-32,40-50**：JWT 签验字段不一致（见 P0 汇总 #3）。受影响端点：`rolePermissionList`、`profile`、`profile/update`、`changePassword`。修复：`validate` 返回 `{ userId: payload.userId, username: payload.username }`，并加集成测试。

### P1
- **sso-auth-guard + user.service.ts:185-210**：全程无人校验 tokenType（同共享库 P1 第一条，此处为业务侧影响面）。
- **api/system-config/user.service.ts:126-127 [历史复发 P1-3]**：`createUser` 密码只哈希一次，与登录校验的双重哈希不一致——管理员创建的用户无法登录。
- **api/audit-log/audit-log.controller.ts:9-29**：审计日志查询无 AdminGuard，任何登录用户可拉取全量审计日志（含 requestBody 原文）。
- **api/user/user.controller.ts:80-83 + user.service.ts:47-62,80-98**：`POST /api/user/admin/reset-password` 仅靠 NODE_ENV 保护，任何登录用户可清空 admin 密码；叠加"admin 密码为空则任何人设密码并登录"逻辑，构成完整 admin 接管链。
- **api/tracking-node/tracking-node.service.ts:93,97**：MySQL 使用 `ILIKE`（MySQL 不支持），按 name/code 筛选必抛语法错误。
- **api/data-analysis/user-path-analysis.service.ts:43-48**：SQL builder 返回 error 未检查就执行（其余四个分析服务都有检查）。
- **api/property/property.controller.ts:55-61**：`createProperty` 仅要求登录即执行 ALTER TABLE DDL（注入已修，缺权限校验）。

### P2
- **configuration.ts + user.service.ts:230-231**：HMAC_SECRET/SALT 默认空串且无启动校验，与 JWT_SECRET 的强制处理不一致。
- **api/audit-log/audit-log.interceptor.ts（全文件）**：从未注册，写操作审计完全未生效；redactSensitive 正则会明文记录 oldPassword/newPassword；跳过路径 `/auth/login` 与实际 `/api/user/login` 不符。
- **api/datasource/datasource.service.ts:71-81**：数据源密码明文入库，无加密。
- **system-config/user.service.ts:190-197,272-278；role.service.ts:278-289,378-386**：角色/权限"先删后插"无事务，中途失败整体丢失；updateUser 不校验 roleIds 存在性。
- **5 个分析服务下载任务**：初始 Redis 写入无 TTL，worker 宕机则任务 key 永久残留。
- **app.module.ts:57-58**：BullMQ `removeOnComplete/removeOnFail: false`，任务记录无限堆积 Redis。
- **EventAnalysisSqlBuilder.ts:39-56,341-373**：generateDateList 无范围上限，恶意大时间范围可构造数千列巨型 SQL 拖垮 ClickHouse。
- **user-segmentation.service.ts:51-71,144-146**：分群全量 user_id 无 LIMIT 读入内存并整体写 Redis 单 key。
- **api/system-data/data-analysis.service.ts vs analysis.service.ts**：两文件几乎逐行重复，前者未注册，纯死代码。
- **tracking-node.service.ts:239-276,376-405**：`save({code,...})` 按主键 upsert，更新不存在的 code 会插入缺字段脏数据。
- **tracking-node.service.ts:185-190,336-341**：直接解引用 `item.createUser.username`，createUser 可为 null，触发 500。
- **data-analysis.controller.ts:54-66 等**：recordAccess/recordQuery 被 await 串行执行，统计写库失败拖垮业务查询。应 fire-and-forget。

### P3
- **throttle.guard.ts:38**：限流信任可伪造的 `x-forwarded-for`。
- **user.controller.ts:36-37**：refreshToken 走 GET query，token 进访问日志/浏览器历史。
- **project.service.ts:143-157**：addMembers 循环 findOne+save，2N 次 DB 往返。
- **system-config/system.service.ts:113-165 [历史复发]**：残留 6 处调试 console.log。
- **tracking-node.service.ts:38-45**：Math.random 生成业务主键 code，无唯一性校验。
- **admin.guard.ts:23-31**：每请求 2 次 DB 查询，可短 TTL 缓存。
- **多个管理列表端点**：pageSize 无上限（event.controller.ts:39 已有 Math.min 模式可复用）。
- **DTO 全为 interface**：全局 ValidationPipe 实际不校验任何请求体，属系统性疏漏。

### 总体评价
上轮修复主要受益者：5 个 SQL Builder 已全面参数化，SQL 注入面收敛。但新增 P0 级 JWT 签验断裂须立即修复；admin 密码接管链、审计日志无角色校验、createUser 单重哈希为第二梯队。写路径普遍缺事务与资源生命周期意识；AuditLogInterceptor 未注册、整文件死代码等"写了没接线"问题成体系。

## 五、数据管道三服务（receiving-point / preliminary-processing / final-cleaning）

### P1
- **preliminary kafka-consumer.service.ts:24-35**：`data.$spm?.split('.')` 为 undefined 时 `data[i]` 抛 TypeError 被吞掉，无 SPM/SCM 的事件全部绕过主表 event_log 丢失。
- **preliminary kafka-consumer.service.ts:35**：查询条件写反——`if (data[i]) continue` 应为 `if (!data[i]) continue`；四段全存在时退化为 tracking_node 全表扫描。
- **preliminary main.ts:21-34 [历史复发]**：consumer 配置（autoCommit/offsetReset/batchSize）全部是死配置，offset 语义退回默认；event_log 无去重键，重投产生重复行。应手动提交 offset + 幂等键/ReplacingMergeTree。
- **三服务 main.ts**：均未 `app.enableShutdownHooks()`，SIGTERM 时连接不优雅关闭，在途消息丢失/重复。
- **final-cleaning node.service.ts:63-68**：`getAllEvents` SQL 无 ORDER BY，而归因算法依赖时间序输入，归因链会错乱。
- **final-cleaning node.service.ts:91-92,151-167**：进度上报失效（interval 在 insert 完成后才订阅，takeWhile 立即 false），且第一条任务结束就 complete 整个 gRPC 流，后续任务失联。
- **final-cleaning node.service.ts:54,77-83**：executeTask fire-and-forget 无 try/catch，unhandledRejection，任务静默失败，proto 定义的 failed/error 字段从不使用。
- **final-cleaning node.service.ts:143-148**：两表 Promise.all 并发写无原子性（TODO 手动回滚未实现），任务重复下发无幂等，产生重复行。

### P2
- **receiving-point point.service.ts:39-55**：批量上报任一失败整批报错，已入 Kafka 的事件因客户端重试产生重复。应 allSettled 逐条隔离。
- **point.service.ts:104-106 + kafka-consumer.service.ts:79-164**：Kafka emit 未设 message key，同 deviceId 事件不保证同 partition，session 切割竞态（两个并发事件各生成不同 sessionId）。应以 deviceId 为 key + Redis Lua/CAS。
- **kafka-consumer.service.ts:191**：每条消息单独 insert ClickHouse，无批量聚合，too many parts 风险，无背压。
- **kafka-consumer.service.ts:193-202 [历史复发]**：`JSON.stringify(Error)` 结果是 `{}`，error_log 丢失错误信息；catch 后正常返回即提交 offset，消息永不重试，无 DLQ。
- **final node.service.ts:91-142 vs lib/attribution-engine.ts**：归因算法两份拷贝（测试测 engine，线上跑内联版），已开始漂移。
- **final proto:62-64**：`NodeInfoService.GetNodeInfo` 已定义未实现，调用方拿 UNIMPLEMENTED。
- **final node.service.ts:66-67**：`$session_id` 未加反引号（`$service_time` 加了），ClickHouse 标识符解析失败风险。

### P3
- **point.controller.ts:44,92**：信任可伪造的 x-forwarded-for 且未取首跳；`req.connection` 已废弃。
- **receiving-point main.ts:24-27**：CORS `origin:true + credentials:true`，埋点场景 credentials 无必要。
- **kafka-consumer.service.ts:108-113**：时间回拨分支返回当前事件空 utm，与缓存回填逻辑不一致。

### 总体评价
分层职责清晰，接收端已按历史评审补齐 Kafka await 与白名单。但整条管道没有任何一环保住"不丢不重"：offset 语义不清、无幂等键、无重试/DLQ、两表写入无原子性。final-cleaning 完成度最低（进度流/失败上报/节点信息三个 proto 能力均未真正工作），且归因输入未排序直接导致核心产出错误。

## 六、frontend - 页面层

### P0
- **login/index.tsx:29-30**：开放重定向（见 P0 汇总 #5）。修复：跳转前校验同源，非法回退 `/`。

### P1
- **layout/RouteGuard/index.tsx:14-27**：① 只校验 token 存在性，伪造任意字符串即通过；② useEffect 跳转但无条件渲染子树，未登录时受保护页面仍挂载发请求；③ `usePermission`/`usePathPermission` 零调用，管理页面对任何登录用户敞开 UI（后端 AdminGuard 兜底）。应渲染期判断 + 按路由 meta 接入页面级鉴权。
- **data-analysis/components/DownloadPopup/index.tsx:48-71**：`timer = useRef(false)` 初始 false 且无人置 true，8 级进度动画从不执行，死代码。

### P2
- **account-center/index.tsx:235-244 [历史复发]**：硬编码 `username === 'admin'` 特权判断（与已修 P1-9 同类）。
- **dashboard-config/index.tsx:262-264**：看板编辑/删除只看 type===PERSONAL，无所有者/管理员校验（注释自承）。
- **event/funnel/attribution/user-path 下载轮询**：setInterval 每秒轮询仅在 SUCCESS 时清理，FAILED/异常时无限打 API + 未处理 rejection。
- **Guide.tsx + App.tsx + guide/index.tsx**：路由扁平注册导致 Guide 嵌套外壳失效，`<Outlet/>` 永无内容；`path:''` 产生重复 /guide 死路由。
- **free/components/DataTable/index.tsx:30-32,152-158**：URL 参数 timeRange 驱动无上限日期循环，构造数年跨度即卡死浏览器。
- **frontend config/configuration.ts:27-28**：SALT/HMAC_SECRET 打包进客户端 bundle，客户端 HMAC 形同明文（关联历史 P0-6）。

### P3
- **utils/storage.ts:16**：`Localstorage.set` 静默丢弃 falsy 值（0/false/''）。
- **usePermission.ts:8,67-84**：模块级 userInfo 快照 + 缓存永不清除，切换账号后 key 仍用旧 id。
- **computing-node/log/index.tsx:37-73**：生产可访问的 2023 年假数据占位页。
- **system-params/index.tsx:69-73**：编辑/详情为无 onClick 死按钮。

### 总体评价
风格统一，无 dangerouslySetInnerHTML，路由均 lazy。最突出问题是权限体系名存实亡（基础设施修好没人接线）；login 开放重定向是唯一可直接利用的 P0；多个页面存在"写了但跑不通"的半成品逻辑。

## 七、frontend - 基础设施层

### P1
- **lib/request/request.ts:24-33**：TOKEN_EXPIRED 处理链断裂——触发刷新后直接 return undefined，原请求不重试；调用方对 undefined 取 `.data` 抛 TypeError；`actionRefreshToken` 无并发去重，多并发 401 触发多次刷新 + 多次 `location.reload()`。应单例 Promise + 重放原请求。
- **lib/request/cancelToken.ts:4-16**：每请求推入模块级静态数组，cancel/clean 零调用，内存泄漏；取消逻辑已注释，机制名存实亡；axios CancelToken 已官方废弃。应改 AbortController 或删除。
- **main.tsx:16 + app/model.ts:24-31 + user/model.ts:43-50**：init 链路 queryPermissionInfo 失败冒泡到 render() 的 await，`root.render()` 永不执行，用户永久白屏无提示。
- **app/model.ts:56-57 [历史复发]**：`userInfo.roles?.some` 未对 userInfo 本身可选链；跳转登录后继续执行 validRouter，undefined 解引用抛 TypeError（P1-9 修复遗留）。

### P2
- **usePermission.ts:8,67-83 [历史复发]**：缓存 key 用 `staffId`（实际字段是 userId，恒 -1），用户隔离形同虚设；静态 Set 永不清理。
- **usePermission.ts:43**：非响应式快照读取，权限更新不重渲染；51-53 行不可达死代码。
- **usePermission.ts:3**：从 `@/models/application/type` 导入，该目录不存在（构建器不做类型检查才不报错）。
- **utils/index.ts:3-25**：LoadingToast 全局单例，并发请求互相覆盖 closeFun 误关 loading；request/index.tsx:89,123 重复 destory。
- **request/index.tsx:101-103**：noCatch 分支丢弃原始错误，统一 reject `{noMessage:true}`，无法区分超时/401/业务错误。
- **form-item/upload/index.tsx:22-31**：onChange 在 uploading 阶段多次触发 submit，文件未传完就多次提交。
- **storage.ts + ssoAuth.ts [历史复发]**：token 明文 localStorage，XSS 可窃取（FIX_REPORT 已列 httpOnly Cookie 待办）。

### P3
- **utils/signature.ts、encryption.ts**：无任何业务引用，死代码。
- **user/services.ts:37**：`request<{ data: IUser }>` 多包一层 data，与后端 ResponseData<IUser> 不符。
- **form-item/slider/index.tsx:28-31**：拖动过程连续 submit 形成请求风暴，应用 onChangeComplete。
- **request.ts:8**：全局 10s timeout 对导出/下载类接口过短，应允许 IOption 级覆盖。

### 总体评价
骨架清晰，组件粒度小。请求层是最薄弱环节（过期重试断裂、取消机制泄漏、loading 并发缺陷），建议整体重构 lib/request 并迁移 AbortController。P1 白屏/崩溃路径在弱网场景必然复现，应优先处理。

## 八、ecommerce-demo + 工程配置

### P0
- **scripts/clean-db.js、setup-metadata.js**：见 P0 汇总 #1/#2。

### P1
- **Dockerfile:57**：`COPY ... ./proto 2>/dev/null || true`——COPY 不经 shell，重定向被当作源路径，且 proto 目录在 builder 阶段不存在；docker-compose 四个后端服务均引用此 Dockerfile，`docker compose build` 必然失败。
- **docker-compose.yml:159-161,216-218,332-337 [历史复发]**：SIGNATURE_SECRET/SALT/HMAC_SECRET/JWT_SECRET 全部提供弱默认值，使 P0-4"未配置即抛错"防护在 Docker 部署下完全失效。
- **ecommerce-demo utils/probeX.ts:18 + 全部页面**：SDK autoTrackPageView 自动上报 page_view，demo 每页又手动 trackPageView，重复上报；StrictMode 下再翻倍。作为官方接入示范会误导接入方。
- **scripts/docker-manage.sh:154,185**：脚本从不 source .env，备份/恢复永远落到硬编码回退密码 `probe_x_root_2024`。

### P2
- **docker/nginx.conf**：生产配置无任何安全响应头（X-Content-Type-Options/X-Frame-Options/Referrer-Policy/CSP）。
- **.env.example:6,12,36 + docker-compose.yml:14-17,106**：确定性弱密码示例值 + compose 同值默认，形成公开默认凭据。
- **scripts/publish-sdk.sh:80-84,281-285**：测试失败仅打印跳过仍继续发布；版本 bump 在 build 后且不 commit，npm 版本与仓库必然漂移。
- **scripts/docker-manage.sh:136**：clean 命令 `docker system prune -f` 清理宿主机全局资源，超出提示文案范围。

### P3
- **probeX.ts:14-16**：apiUrl/debug 硬编码 localhost，未走环境变量。
- **DevTools.tsx:67-113**：拖拽 useEffect 依赖 position，mousemove 中反复解绑/重绑 document 监听。

### 总体评价
generate-test-data.js/sync-metadata.js 质量不错，但 clean-db.js/setup-metadata.js 把凭据与鉴权绕过流程提交进仓库，是全仓库最高危问题。Dockerfile 语法错误导致后端 Docker 构建必然失败；compose 弱默认值抵消上轮 P0-4 防护。demo 未提交改动基本为格式化，但 lint 有 4 个 error 需修。

## 九、历史问题复发对照

| 历史问题 | 现状 |
|---------|------|
| SDK autoTrack 事件不上报（backend-and-sdk 1.1） | **未修**（P0-4） |
| fetch/XHR patch 不可还原（1.2） | **未修** |
| SessionReplay 不脱敏（1.4） | **未修** |
| config reset() 清空默认值（1.5） | **未修** |
| Kafka 重试/死信、降级策略（4.2/5.2） | **未实现** |
| createUser 双重哈希（FIX P1-3） | **复发**于 system-config/user.service.ts |
| 调试 console.log（FIX P0-1） | **复发**于 system.service.ts（6 处） |
| 硬编码管理员判断（FIX P1-9） | **复发**于 account-center（username==='admin'） |
| 密钥弱默认值（FIX P0-4） | **以 compose 默认值形式复发** |
| token httpOnly Cookie（FIX 待办） | **未实施** |
| usePermission 缓存（FIX P1-7） | 部分修复，仍残留 staffId/快照问题 |
| SQL 注入、noSignature 后门、AdminGuard、登录限流 | ✅ 已修复未复发 |

## 十、修复优先级建议

**第一梯队（本周）**
1. 轮换泄露凭据（DB root、SALT/HMAC_SECRET），清理 git 历史，删除/改造 clean-db.js、setup-metadata.js（P0-1/2）
2. 修 JwtStrategy payload 字段不匹配（P0-3）
3. 修 SDK autoTrack 上报断链 + 自请求过滤（P0-4）
4. 修 login 开放重定向（P0-5）
5. 修 preliminary 服务 spm/scm 空值崩溃与条件反转（数据丢失）
6. 修 web-sdk jest.config.js ESM 问题 + ecommerce-demo 4 个 lint error（恢复质量门禁）

**第二梯队**
- SsoAuthGuard tokenType 校验；admin 密码接管链；审计日志 AdminGuard；createUser 双重哈希
- SDK destroy 清理体系（observer/listener/timer/patch 还原）
- final-cleaning 归因排序、executeTask 异常捕获、进度流修复
- frontend 请求层重构（token 刷新重放、AbortController、白屏兜底）
- Dockerfile proto COPY 修复；compose 移除密钥默认值

**第三梯队**
- 端到端幂等方案（Kafka key、offset 手动提交、CH 去重）
- 签名拦截器 nonce 防重放 + 启用范围明确化
- 事务补齐（角色/权限先删后插）、Redis TTL、BullMQ 清理策略
- 前端权限体系接线（RouteGuard + usePathPermission）
