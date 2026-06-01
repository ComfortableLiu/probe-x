## Overview

异常告警系统，支持配置告警规则，告警触发时通过 NotificationModule 发送通知。

## API

### GET /alert/rules
查询告警规则列表

### POST /alert/rules/create
创建告警规则

### POST /alert/rules/update
更新告警规则

### POST /alert/rules/delete
删除告警规则

### GET /alert/history
查询告警历史列表（分页、支持按规则/级别/时间筛选）

## Behavior

- 告警规则类型：event_count_spike（事件量异常波动）、funnel_conversion_drop（漏斗转化率下降）、custom（自定义）
- 告警级别：warning、critical
- 告警触发时通过关联的通知配置发送通知
- 告警历史记录触发时间、规则信息、告警内容、通知状态
