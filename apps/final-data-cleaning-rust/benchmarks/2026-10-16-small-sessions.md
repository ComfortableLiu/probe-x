# 小会话 I/O 优化基准（2026-10-16）

使用 `scripts/benchmark-final-cleaning-rust.cjs` 启动完全隔离的本地 Redis、ClickHouse、gRPC 模拟服务，
子进程只接收临时本地配置，不读取项目 env，也不连接业务服务。
固定 224 个会话、每会话 7 条事件和 6 条归因 KV，共 1568 条最终事件和 1344 条 KV。
Redis 每条命令响应延迟 20ms（并行请求可重叠），HTTP 每次请求延迟 10ms。每组独立运行 3 次。

| 版本与配置 | 所有任务完成均值 | 完成范围 | 两表完整落库均值 | 每表 INSERT 平均次数 |
|---|---:|---:|---:|---:|
| 优化前，CPU 14 / 任务槽 14 | 3648.85ms | 3604.40–3673.27ms | 3539.37ms | 224 |
| 优化后，CPU 14 / 任务槽 14 | 2311.38ms | 2271.35–2352.70ms | 2264.86ms | 22 |
| 优化后，CPU 14 / 任务槽 56 | 596.98ms | 586.24–610.19ms | 552.43ms | 6.67 |

同容量下任务完成耗时降低 36.65%；默认 4 倍 I/O 槽的结果还包含增加并发任务的收益。
跨三轮按总行数/总请求数计算，单次最终事件 INSERT 平均行数依次为 7、71.27、235.20。
9 轮全部验证两表完整、无重复，每个完成帧到达时其两表数据及 Redis 完成标记已存在，且子进程正常退出。

计时从首个任务下发开始，不包含启动；“所有任务完成”还等待完成帧，“完整落库”只等待两张表的数据完整。
监控指标的 Redis 调用在计时窗口内分别为 448、2、0；最后一组运行不足一秒，退出时会刷新，
该次退出刷新不计入窗口内调用数，因此 0 不代表没有上报指标。

这是固定延迟的小会话模型，未包含真实 ClickHouse 扫描、磁盘和合并成本，也未测超大单会话。
不能将这些数字视为生产加速倍数或 Node 与 Rust 的性能对比。

```bash
# 同容量实现对比：用 --binary 分别指定保留的旧、新 release 二进制
node scripts/benchmark-final-cleaning-rust.cjs \
  --binary apps/final-data-cleaning-rust/target/release/probe-x-final-cleaning-rust \
  --cpu-threads 14 --capacity 14 --output tmp/rust-same-capacity.json
# 同样 14 个 CPU 计算线程，增加 I/O 槽以隐藏网络等待
node scripts/benchmark-final-cleaning-rust.cjs \
  --binary apps/final-data-cleaning-rust/target/release/probe-x-final-cleaning-rust \
  --cpu-threads 14 --capacity 56 --output tmp/rust-default-capacity.json
```
