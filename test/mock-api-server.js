/**
 * Mock API Server — runs on port 8101 to intercept backend requests.
 * Returns mock data for all /api/* endpoints so the frontend can render
 * without real MySQL/ClickHouse/Kafka/Redis services.
 */
const http = require('http');

const PORT = 8101;

const jsonResponse = (res, data) => {
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,PATCH,OPTIONS',
    'Access-Control-Allow-Headers': '*',
  });
  res.end(JSON.stringify({ code: 200, data, message: 'success' }));
};

const userProfile = {
  id: 1, username: 'admin', nickname: '管理员',
  email: 'admin@probe-x.dev', avatar: '', role: 'super_admin',
  permissions: ['*'],
  roleList: [{ id: 1, name: '超管', key: 'super_admin' }],
};

const permissionTree = [
  { id: 1, name: '首页', key: 'homepage', children: [] },
  { id: 2, name: '埋点管理', key: 'point-manage', children: [
    { id: 21, name: '事件管理', key: 'point-manage:event' },
    { id: 22, name: '属性管理', key: 'point-manage:property' },
    { id: 23, name: 'SPM管理', key: 'point-manage:spm' },
    { id: 24, name: 'SCM管理', key: 'point-manage:scm' },
    { id: 25, name: '基础编码管理', key: 'point-manage:basic-coding' },
  ]},
  { id: 3, name: '数据分析', key: 'data-analysis', children: [
    { id: 31, name: '事件分析', key: 'data-analysis:event' },
    { id: 32, name: '漏斗分析', key: 'data-analysis:funnel' },
    { id: 33, name: '自由分析', key: 'data-analysis:free' },
    { id: 34, name: '用户路径分析', key: 'data-analysis:userPath' },
    { id: 35, name: '归因分析', key: 'data-analysis:attribution' },
    { id: 36, name: '看板设置', key: 'data-analysis:dashboardConfig' },
  ]},
  { id: 4, name: '系统数据', key: 'system-data', children: [
    { id: 41, name: '总览', key: 'system-data:overview' },
    { id: 42, name: '数分数据', key: 'system-data:analysis' },
    { id: 43, name: '元数据', key: 'system-data:meta' },
    { id: 44, name: '计算节点', key: 'system-data:computingNode' },
  ]},
  { id: 5, name: '系统设置', key: 'system-config', children: [
    { id: 51, name: '用户管理', key: 'system-config:user' },
    { id: 52, name: '系统管理', key: 'system-config:system' },
    { id: 53, name: '计算节点配置', key: 'system-config:computing-node' },
    { id: 54, name: '角色管理', key: 'system-config:role' },
    { id: 55, name: '系统参数配置', key: 'system-config:system-params' },
    { id: 56, name: '数据源配置', key: 'system-config:datasource' },
    { id: 57, name: '通知设置', key: 'system-config:notification' },
    { id: 58, name: '日志配置', key: 'system-config:log-config' },
    { id: 59, name: '项目管理', key: 'system-config:project' },
    { id: 60, name: '审计日志', key: 'system-config:audit-log' },
    { id: 61, name: '告警管理', key: 'system-config:alert' },
  ]},
];

const emptyList = { list: [], total: 0, items: [] };

const server = http.createServer((req, res) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,PATCH,OPTIONS',
      'Access-Control-Allow-Headers': '*',
    });
    return res.end();
  }

  const url = req.url || '';
  const method = req.method || 'GET';

  // --- User endpoints ---
  if (url.includes('/api/user/profile') && !url.includes('update')) {
    return jsonResponse(res, userProfile);
  }
  if (url.includes('/api/user/profile/update')) {
    return jsonResponse(res, { success: true });
  }
  if (url.includes('/api/user/rolePermissionList')) {
    return jsonResponse(res, permissionTree);
  }
  if (url.includes('/api/user/refreshToken')) {
    return jsonResponse(res, { accessToken: 'mock-token', refreshToken: 'mock-refresh' });
  }
  if (url.includes('/api/user/login')) {
    return jsonResponse(res, {
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
      userInfo: userProfile,
    });
  }
  if (url.includes('/api/user/changePassword')) {
    return jsonResponse(res, { success: true });
  }

  // --- Homepage ---
  if (url.includes('/api/homepage/overview')) {
    return jsonResponse(res, {
      totalEvents: 125000, todayEvents: 3200,
      totalUsers: 5000, todayUsers: 120,
      totalSessions: 18000, todaySessions: 450,
      avgResponseTime: 45, systemAvailability: 99.8,
    });
  }
  if (url.includes('/api/homepage/trend')) {
    return jsonResponse(res, { dates: [], values: [] });
  }
  if (url.includes('/api/homepage/realtime-events')) {
    return jsonResponse(res, { list: [], total: 0 });
  }

  // --- Dashboard ---
  if (url.includes('/api/dashboard')) {
    return jsonResponse(res, emptyList);
  }

  // --- Property/Event metadata ---
  if (url.includes('/api/property/commonList')) {
    return jsonResponse(res, []);
  }
  if (url.includes('/api/property/list')) {
    return jsonResponse(res, emptyList);
  }

  // --- All list/simple endpoints ---
  if (url.includes('/list') || url.includes('/simple') || url.includes('/commonList')) {
    return jsonResponse(res, emptyList);
  }

  // --- CRUD endpoints ---
  if (method === 'POST' || method === 'PUT' || method === 'DELETE' || method === 'PATCH') {
    return jsonResponse(res, { success: true, id: 1 });
  }

  // --- Default: empty success ---
  return jsonResponse(res, {});
});

server.listen(PORT, () => {
  console.log(`[E2E] Mock API server on http://localhost:${PORT}`);
});
