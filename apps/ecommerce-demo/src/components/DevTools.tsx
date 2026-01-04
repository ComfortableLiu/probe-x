import React, { useState, useEffect, useRef } from 'react';
import { Card, Button, Space, Typography, Select, Divider, message } from 'antd';
import { ToolOutlined, CloseOutlined } from '@ant-design/icons';
import { getProbeX } from '../utils/probeX';

// 简单的UUID生成函数
const generateUUID = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // 降级方案
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

const { Text, Title } = Typography;
const { Option } = Select;

// 测试用户列表
const TEST_USERS = [
  { id: '1', username: '张三', email: 'zhangsan@example.com' },
  { id: '2', username: '李四', email: 'lisi@example.com' },
  { id: '3', username: '王五', email: 'wangwu@example.com' },
  { id: '4', username: '赵六', email: 'zhaoliu@example.com' },
  { id: '5', username: '钱七', email: 'qianqi@example.com' },
];

interface Position {
  x: number;
  y: number;
}

const DevTools: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState<Position>({ x: window.innerWidth - 100, y: 100 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState<Position>({ x: 0, y: 0 });
  const [currentUser, setCurrentUser] = useState(TEST_USERS[0]);
  const [deviceId, setDeviceId] = useState<string>('');
  const [sessionId, setSessionId] = useState<string>('');
  
  const iconRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // 获取设备ID和会话ID
  useEffect(() => {
    const updateIds = () => {
      const probeX = getProbeX();
      const session = probeX.getSession();
      setSessionId(session.id);
      
      // 从localStorage获取设备ID
      const deviceKey = 'probe_x_device_id';
      const storedDeviceId = localStorage.getItem(deviceKey);
      setDeviceId(storedDeviceId || '');
    };

    updateIds();
    const interval = setInterval(updateIds, 1000);
    return () => clearInterval(interval);
  }, []);

  // 图标拖动处理
  useEffect(() => {
    if (!iconRef.current) return;

    const handleMouseDown = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('.dev-tools-panel')) {
        return;
      }
      setDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      });
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragging) return;
      
      const newX = e.clientX - dragStart.x;
      const newY = e.clientY - dragStart.y;
      
      // 限制在窗口内
      const maxX = window.innerWidth - 50;
      const maxY = window.innerHeight - 50;
      const minX = 0;
      const minY = 0;
      
      setPosition({
        x: Math.max(minX, Math.min(maxX, newX)),
        y: Math.max(minY, Math.min(maxY, newY)),
      });
    };

    const handleMouseUp = () => {
      setDragging(false);
    };

    const iconElement = iconRef.current;
    iconElement.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      iconElement.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging, dragStart, position]);

  // 切换用户
  const handleSwitchUser = (userId: string) => {
    const user = TEST_USERS.find(u => u.id === userId);
    if (user) {
      const probeX = getProbeX();
      probeX.setUser({
        user_id: user.id,
        user_name: user.username,
        email: user.email,
      });
      setCurrentUser(user);
      message.success(`已切换用户：${user.username}`);
    }
  };

  // 切换设备ID
  const handleSwitchDeviceId = () => {
    const newDeviceId = generateUUID();
    const deviceKey = 'probe_x_device_id';
    localStorage.setItem(deviceKey, newDeviceId);
    setDeviceId(newDeviceId);
    message.success('设备ID已切换，请刷新页面生效');
  };

  // 新会话
  const handleNewSession = () => {
    // 清除会话相关的localStorage (使用session-manager的键名格式)
    const prefix = 'probe_x_';
    const sessionKey = `${prefix}session_id`;
    const sessionTimeKey = `${prefix}session_time`;
    const sessionStartKey = `${prefix}session_start_time`;
    const pageViewsKey = `${prefix}session_page_views`;
    const eventsKey = `${prefix}session_events`;
    
    localStorage.removeItem(sessionKey);
    localStorage.removeItem(sessionTimeKey);
    localStorage.removeItem(sessionStartKey);
    localStorage.removeItem(pageViewsKey);
    localStorage.removeItem(eventsKey);
    
    // 生成新的会话ID
    const newSessionId = generateUUID();
    const now = Date.now();
    localStorage.setItem(sessionKey, newSessionId);
    localStorage.setItem(sessionTimeKey, now.toString());
    localStorage.setItem(sessionStartKey, now.toString());
    
    setSessionId(newSessionId);
    message.success('新会话已创建，请刷新页面生效');
  };

  return (
    <>
      {/* 悬浮图标 */}
      <div
        ref={iconRef}
        onClick={() => !dragging && setVisible(!visible)}
        style={{
          position: 'fixed',
          left: `${position.x}px`,
          top: `${position.y}px`,
          width: '50px',
          height: '50px',
          borderRadius: '50%',
          backgroundColor: '#1890ff',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: dragging ? 'grabbing' : 'grab',
          zIndex: 9999,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          transition: dragging ? 'none' : 'box-shadow 0.3s',
        }}
        onMouseEnter={(e) => {
          if (!dragging) {
            e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.2)';
          }
        }}
        onMouseLeave={(e) => {
          if (!dragging) {
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
          }
        }}
      >
        <ToolOutlined style={{ fontSize: '24px' }} />
      </div>

      {/* 工具面板 */}
      {visible && (
        <div
          ref={panelRef}
          className="dev-tools-panel"
          style={{
            position: 'fixed',
            left: `${Math.min(position.x + 60, window.innerWidth - 380)}px`,
            top: `${Math.min(position.y, window.innerHeight - 400)}px`,
            width: '360px',
            maxHeight: '80vh',
            zIndex: 10000,
            boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <Card
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>开发者工具</span>
                <Button
                  type="text"
                  icon={<CloseOutlined />}
                  onClick={() => setVisible(false)}
                />
              </div>
            }
            style={{ borderRadius: '8px' }}
          >
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              {/* 当前用户信息 */}
              <div>
                <Title level={5}>当前用户</Title>
                <Select
                  value={currentUser.id}
                  onChange={handleSwitchUser}
                  style={{ width: '100%' }}
                >
                  {TEST_USERS.map(user => (
                    <Option key={user.id} value={user.id}>
                      {user.username} ({user.email})
                    </Option>
                  ))}
                </Select>
              </div>

              <Divider style={{ margin: '12px 0' }} />

              {/* 设备ID */}
              <div>
                <Title level={5}>设备ID</Title>
                <div style={{ marginBottom: '8px' }}>
                  <Text code style={{ fontSize: '12px', wordBreak: 'break-all' }}>
                    {deviceId || '加载中...'}
                  </Text>
                </div>
                <Button
                  type="primary"
                  block
                  onClick={handleSwitchDeviceId}
                >
                  一键切换设备ID
                </Button>
              </div>

              <Divider style={{ margin: '12px 0' }} />

              {/* 会话ID */}
              <div>
                <Title level={5}>会话ID</Title>
                <div style={{ marginBottom: '8px' }}>
                  <Text code style={{ fontSize: '12px', wordBreak: 'break-all' }}>
                    {sessionId || '加载中...'}
                  </Text>
                </div>
                <Button
                  type="primary"
                  block
                  onClick={handleNewSession}
                >
                  一键新Session
                </Button>
              </div>

              <Divider style={{ margin: '12px 0' }} />

              {/* 提示信息 */}
              <div>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  💡 提示：切换设备ID或Session后，建议刷新页面以确保生效
                </Text>
              </div>
            </Space>
          </Card>
        </div>
      )}
    </>
  );
};

export default DevTools;

