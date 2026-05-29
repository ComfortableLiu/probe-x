## Overview

多租户项目隔离能力，允许在同一个 Probe-X 实例中创建多个项目，每个项目的数据相互隔离。

## API

### GET /project/list
查询项目列表（分页、模糊搜索）

### POST /project/create
创建项目

### POST /project/update
更新项目

### POST /project/delete
删除项目

### GET /project/:id/members
查询项目成员列表

### POST /project/:id/members/add
添加项目成员

### POST /project/:id/members/remove
移除项目成员

## Behavior

- 项目标识 project_key 全局唯一
- 一个用户可以属于多个项目
- 删除项目时级联删除用户-项目关联
- 埋点接收时通过 project_id 标记数据归属
