# 权限点和角色权限分配表

## 权限体系说明

权限采用三级层级结构：
- **Level 1（页面权限）**：对应系统中的各个页面，控制用户能否访问该页面
- **Level 2（功能权限）**：对应页面内的功能操作（增删改查等），控制用户能否执行特定操作
- **Level 3（子功能权限）**：对应更细粒度的操作（如导出、导入等），控制用户能否执行特定子操作

## 权限点列表

### 1. 系统配置模块

#### 1.1 用户管理页面 (`system:config:user`)
- `user:create` - 创建用户
- `user:update` - 更新用户
- `user:delete` - 删除用户
- `user:view` - 查看用户
- `user:reset-password` - 重置密码
- `user:assign-roles` - 分配角色

#### 1.2 角色管理页面 (`system:config:role`)
- `role:create` - 创建角色
- `role:update` - 更新角色
- `role:delete` - 删除角色
- `role:view` - 查看角色
- `role:assign-permissions` - 分配权限

#### 1.3 权限管理页面 (`system:config:permission`)
- `permission:create` - 创建权限
- `permission:update` - 更新权限
- `permission:delete` - 删除权限
- `permission:view` - 查看权限

#### 1.4 数据源配置页面 (`system:config:datasource`)
- `datasource:create` - 创建数据源
- `datasource:update` - 更新数据源
- `datasource:delete` - 删除数据源
- `datasource:view` - 查看数据源
- `datasource:test` - 测试连接

#### 1.5 系统参数配置页面 (`system:config:system-params`)
- `system:params:create` - 创建系统参数
- `system:params:update` - 更新系统参数
- `system:params:delete` - 删除系统参数
- `system:params:view` - 查看系统参数

#### 1.6 计算节点配置页面 (`system:config:computing-node`)
- `computing:node:create` - 创建计算节点
- `computing:node:update` - 更新计算节点
- `computing:node:delete` - 删除计算节点
- `computing:node:view` - 查看计算节点

#### 1.7 通知设置页面 (`system:config:notification`)
- `notification:create` - 创建通知配置
- `notification:update` - 更新通知配置
- `notification:delete` - 删除通知配置
- `notification:view` - 查看通知配置

#### 1.8 日志配置页面 (`system:config:log-config`)
- `log:config:create` - 创建日志配置
- `log:config:update` - 更新日志配置
- `log:config:delete` - 删除日志配置
- `log:config:view` - 查看日志配置

### 2. 埋点管理模块

#### 2.1 事件管理页面 (`point:manage:event`)
- `event:create` - 创建事件
- `event:update` - 更新事件
- `event:delete` - 删除事件
- `event:view` - 查看事件

#### 2.2 属性管理页面 (`point:manage:property`)
- `property:create` - 创建属性
- `property:update` - 更新属性
- `property:delete` - 删除属性
- `property:view` - 查看属性

#### 2.3 SPM管理页面 (`point:manage:spm`)
- `spm:create` - 创建SPM
- `spm:update` - 更新SPM
- `spm:delete` - 删除SPM
- `spm:view` - 查看SPM

#### 2.4 SCM管理页面 (`point:manage:scm`)
- `scm:create` - 创建SCM
- `scm:update` - 更新SCM
- `scm:delete` - 删除SCM
- `scm:view` - 查看SCM

#### 2.5 基础编码管理页面 (`point:manage:basic-coding`)
- `basic-coding:create` - 创建基础编码
- `basic-coding:update` - 更新基础编码
- `basic-coding:delete` - 删除基础编码
- `basic-coding:view` - 查看基础编码

### 3. 数据分析模块

#### 3.1 事件分析页面 (`data:analysis:event`)
- `data:analysis:view` - 查看分析数据
- `data:analysis:export` - 导出分析数据

#### 3.2 漏斗分析页面 (`data:analysis:funnel`)
- `data:analysis:funnel:view` - 查看漏斗分析
- `data:analysis:funnel:export` - 导出漏斗分析

#### 3.3 用户路径分析页面 (`data:analysis:user-path`)
- `data:analysis:user-path:view` - 查看用户路径分析
- `data:analysis:user-path:export` - 导出用户路径分析

#### 3.4 归因分析页面 (`data:analysis:attribution`)
- `data:analysis:attribution:view` - 查看归因分析
- `data:analysis:attribution:export` - 导出归因分析

#### 3.5 看板设置页面 (`data:analysis:dashboard-config`)
- `dashboard:config:create` - 创建看板
- `dashboard:config:update` - 更新看板
- `dashboard:config:delete` - 删除看板
- `dashboard:config:view` - 查看看板

### 4. 系统数据模块

#### 4.1 系统数据概览页面 (`system:data:overview`)
- `system:data:overview:view` - 查看系统数据概览

#### 4.2 元数据页面 (`system:data:meta`)
- `system:data:meta:view` - 查看元数据

#### 4.3 系统数据分析页面 (`system:data:analysis`)
- `system:data:analysis:view` - 查看系统数据分析

#### 4.4 计算节点页面 (`system:data:computing-node`)
- `system:data:computing-node:view` - 查看计算节点

## 系统角色权限分配

### 1. 超管 (super_admin)
- **角色标识**: `super_admin`
- **角色名称**: 超管
- **角色类型**: 系统角色（不可修改和删除）
- **权限范围**: 所有权限
- **说明**: 系统超级管理员，拥有所有权限，唯一账号为admin，无法进行任何新增或删除操作

### 2. 管理员 (admin)
- **角色标识**: `admin`
- **角色名称**: 管理员
- **角色类型**: 系统角色（不可修改和删除）
- **权限范围**: 除管理超管外的所有权限
- **说明**: 系统管理员，拥有除了管理超管角色以外的所有权限
- **排除权限**: `user:assign-roles`（分配角色功能，防止将超管角色分配给其他用户）

### 3. 研发 (developer)
- **角色标识**: `developer`
- **角色名称**: 研发
- **角色类型**: 系统角色（不可修改和删除）
- **权限范围**: 
  - 埋点管理模块（事件、属性、SPM、SCM、基础编码）
  - 系统数据模块（概览、元数据、数据分析、计算节点）
  - 数据分析查看权限
- **说明**: 研发人员角色，拥有开发和配置相关权限

### 4. 数据分析师 (data_analyst)
- **角色标识**: `data_analyst`
- **角色名称**: 数据分析师
- **角色类型**: 系统角色（不可修改和删除）
- **权限范围**: 
  - 数据分析模块（事件分析、漏斗分析、用户路径分析、归因分析、看板设置）
  - 系统数据模块（概览、元数据、数据分析）
  - 事件和属性查看权限
- **说明**: 数据分析师角色，拥有数据分析和查看相关权限

## SQL脚本使用说明

### 执行顺序
1. 先执行权限插入（第一部分）
2. 再执行角色插入（第二部分）
3. 最后执行角色权限关联（第三部分）

### 执行方式
```bash
# 方式1：直接执行SQL文件
mysql -u用户名 -p数据库名 < scripts/migration/init_permissions_and_roles.sql

# 方式2：在MySQL客户端中执行
source scripts/migration/init_permissions_and_roles.sql;
```

### 注意事项
1. 执行前请确保数据库表结构已创建（role、permission、role_permission_relation）
2. 如果表中已有数据，请先备份
3. 建议在测试环境先执行验证
4. 执行后可以通过以下SQL查询验证：
   ```sql
   -- 查看所有权限
   SELECT * FROM permission ORDER BY level, id;
   
   -- 查看所有角色
   SELECT * FROM role;
   
   -- 查看角色权限分配
   SELECT r.role_name, p.permission_key, p.permission_name 
   FROM role r
   JOIN role_permission_relation rpr ON r.id = rpr.role_id
   JOIN permission p ON rpr.permission_id = p.id
   ORDER BY r.role_name, p.level, p.id;
   ```

## 权限扩展说明

如果需要添加新的权限点：
1. 在 `permission` 表中插入新权限记录
2. 设置正确的 `parent_id` 和 `level`
3. 在 `role_permission_relation` 表中为相应角色分配新权限

如果需要添加新的系统角色：
1. 在 `role` 表中插入新角色记录，`role_type` 设置为 `'system'`
2. 在 `role_permission_relation` 表中为新角色分配相应权限
