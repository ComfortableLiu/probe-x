## ADDED Requirements

### Requirement: 数据源列表查询
系统 SHALL 提供分页查询数据源列表的 API，支持按数据源名称和类型筛选。

#### Scenario: 查询全部数据源
- **WHEN** 用户访问数据源配置页面
- **THEN** 系统返回数据源列表，包含名称、类型、连接地址、端口、数据库名、状态、创建时间

#### Scenario: 按名称筛选
- **WHEN** 用户输入数据源名称进行搜索
- **THEN** 系统返回名称包含关键字的数据源列表

### Requirement: 创建数据源
系统 SHALL 支持创建新的数据源配置，包含名称、类型（ClickHouse/MySQL/PostgreSQL）、主机、端口、数据库名、用户名、密码。

#### Scenario: 成功创建数据源
- **WHEN** 用户填写完整信息并提交
- **THEN** 系统创建数据源记录并刷新列表

#### Scenario: 名称重复
- **WHEN** 用户提交已存在的数据源名称
- **THEN** 系统返回错误提示"数据源名称已存在"

### Requirement: 编辑数据源
系统 SHALL 支持编辑已有数据源的配置信息。

#### Scenario: 成功编辑数据源
- **WHEN** 用户修改数据源信息并提交
- **THEN** 系统更新数据源记录并刷新列表

### Requirement: 删除数据源
系统 SHALL 支持删除数据源配置。

#### Scenario: 成功删除数据源
- **WHEN** 用户确认删除操作
- **THEN** 系统删除数据源记录并刷新列表

### Requirement: 测试数据源连接
系统 SHALL 支持测试数据源连接是否可用。

#### Scenario: 测试连接成功
- **WHEN** 用户点击"测试连接"按钮
- **THEN** 系统尝试连接数据源并返回连接结果
