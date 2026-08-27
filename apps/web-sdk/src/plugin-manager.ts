/**
 * 插件管理器
 */

import type { Plugin, PluginConfig, EventHooks } from './types';
import { ConfigManager } from './config';

export class PluginManager {
  private config: ConfigManager;
  private plugins: Map<string, Plugin> = new Map();
  private hooks: EventHooks = {};
  private isInitialized: boolean = false;

  constructor(config: ConfigManager) {
    this.config = config;
  }

  /**
   * 初始化插件管理器
   */
  init(): void {
    if (this.isInitialized) {
      return;
    }

    // 加载配置中的插件
    const pluginConfigs = this.config.get('plugins', []) as PluginConfig[];
    pluginConfigs.forEach(({ name, plugin, options }) => {
      this.register(plugin, options);
    });

    this.isInitialized = true;
  }

  /**
   * 注册插件
   */
  register(plugin: Plugin, options?: any): void {
    if (this.plugins.has(plugin.name)) {
      console.warn(`Plugin ${plugin.name} already registered`);
      return;
    }

    try {
      // 安装插件
      plugin.install(this, options);
      this.plugins.set(plugin.name, plugin);
      
      if (this.config.get('debug')) {
        console.log(`Plugin ${plugin.name} registered successfully`);
      }
    } catch (error) {
      console.error(`Failed to register plugin ${plugin.name}:`, error);
    }
  }

  /**
   * 卸载插件
   */
  unregister(pluginName: string): void {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) {
      console.warn(`Plugin ${pluginName} not found`);
      return;
    }

    try {
      // 卸载插件
      if (plugin.uninstall) {
        plugin.uninstall();
      }
      
      this.plugins.delete(pluginName);
      
      if (this.config.get('debug')) {
        console.log(`Plugin ${pluginName} unregistered successfully`);
      }
    } catch (error) {
      console.error(`Failed to unregister plugin ${pluginName}:`, error);
    }
  }

  /**
   * 获取插件
   */
  getPlugin(pluginName: string): Plugin | undefined {
    return this.plugins.get(pluginName);
  }

  /**
   * 获取所有插件
   */
  getAllPlugins(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * 检查插件是否已注册
   */
  hasPlugin(pluginName: string): boolean {
    return this.plugins.has(pluginName);
  }

  /**
   * 获取配置（供插件读取 SDK 级配置，如 maskSensitiveData）
   */
  getConfig<T = any>(key: string, defaultValue?: T): T {
    return this.config.get(key, defaultValue);
  }

  /**
   * 注册事件钩子
   */
  addHook<K extends keyof EventHooks>(event: K, handler: EventHooks[K]): void {
    if (!this.hooks[event]) {
      (this.hooks as any)[event] = [];
    }
    
    const currentHook = (this.hooks as any)[event];
    if (Array.isArray(currentHook)) {
      currentHook.push(handler);
    } else {
      (this.hooks as any)[event] = [currentHook, handler];
    }
  }

  /**
   * 移除事件钩子
   */
  removeHook<K extends keyof EventHooks>(event: K, handler: EventHooks[K]): void {
    const hooks = this.hooks[event];
    if (!hooks) return;

    if (Array.isArray(hooks)) {
      const index = hooks.indexOf(handler as any);
      if (index > -1) {
        hooks.splice(index, 1);
      }
    } else if (hooks === handler) {
      delete this.hooks[event];
    }
  }

  /**
   * 触发事件钩子
   */
  trigger<K extends keyof EventHooks>(event: K, data?: any): any {
    const hooks = this.hooks[event];
    if (!hooks) return data;

    try {
      if (Array.isArray(hooks)) {
        let result = data;
        for (const hook of hooks) {
          if (typeof hook === 'function') {
            const hookResult = hook(result);
            if (hookResult !== undefined) {
              result = hookResult;
            }
          }
        }
        return result;
      } else if (typeof hooks === 'function') {
        const result = (hooks as any)(data);
        return result !== undefined ? result : data;
      }
    } catch (error) {
      console.error(`Error in hook ${event}:`, error);
      if (this.hooks.error && typeof this.hooks.error === 'function') {
        this.hooks.error(error as Error);
      }
    }

    return data;
  }

  /**
   * 销毁插件管理器
   */
  destroy(): void {
    // 卸载所有插件
    for (const pluginName of this.plugins.keys()) {
      this.unregister(pluginName);
    }

    // 清空钩子
    this.hooks = {};
    this.isInitialized = false;
  }
}

/**
 * 内置插件：A/B测试
 */
export class ABTestPlugin implements Plugin {
  name = 'ab-test';
  version = '1.0.0';
  
  private experiments: Map<string, any> = new Map();
  private config: any;

  install(pluginManager: PluginManager, options: any = {}): void {
    this.config = options;
    
    // 注册钩子
    pluginManager.addHook('beforeTrack', (data: any) => {
      // 为事件添加A/B测试信息
      const abTestInfo = this.getABTestInfo();
      if (abTestInfo) {
        data.properties = {
          ...data.properties,
          ab_test_experiment: abTestInfo.experimentId,
          ab_test_variant: abTestInfo.variantId,
        };
      }
      return true; // 返回boolean表示是否继续处理
    });
  }

  uninstall(): void {
    this.experiments.clear();
  }

  /**
   * 添加实验
   */
  addExperiment(experimentId: string, variants: string[], trafficAllocation: number = 1.0): void {
    // 检查用户是否在实验中
    if (Math.random() > trafficAllocation) {
      return;
    }

    // 随机分配变体
    const variantIndex = Math.floor(Math.random() * variants.length);
    const variantId = variants[variantIndex];

    this.experiments.set(experimentId, {
      experimentId,
      variantId,
      trafficAllocation,
    });

    // 存储到本地存储
    try {
      localStorage.setItem(`ab_test_${experimentId}`, JSON.stringify({
        variantId,
        timestamp: Date.now(),
      }));
    } catch (error) {
      console.warn('Failed to store A/B test data:', error);
    }
  }

  /**
   * 获取实验变体
   */
  getVariant(experimentId: string): string | null {
    const experiment = this.experiments.get(experimentId);
    if (experiment) {
      return experiment.variantId;
    }

    // 从本地存储获取
    try {
      const stored = localStorage.getItem(`ab_test_${experimentId}`);
      if (stored) {
        const data = JSON.parse(stored);
        return data.variantId;
      }
    } catch (error) {
      console.warn('Failed to get A/B test data:', error);
    }

    return null;
  }

  /**
   * 获取A/B测试信息
   */
  private getABTestInfo(): any {
    const experiments = Array.from(this.experiments.values());
    if (experiments.length > 0) {
      return experiments[0]; // 返回第一个实验
    }
    return null;
  }
}

/**
 * 内置插件：热力图
 */
export class HeatmapPlugin implements Plugin {
  name = 'heatmap';
  version = '1.0.0';
  
  private isTracking: boolean = false;
  private heatmapData: any[] = [];
  private config: any;
  // heatmapData 只保留最近 N 条，避免内存无限增长
  private static readonly MAX_HEATMAP_DATA = 5000;
  // 保存事件监听 handler 引用，stopTracking 时移除
  private boundHandleClick = (event: Event) => this.handleClick(event as MouseEvent);
  private boundHandleScroll = () => this.handleScroll();
  private mouseMoveCount = 0;
  private boundHandleMouseMove = (event: Event) => {
    this.mouseMoveCount++;
    if (this.mouseMoveCount % 10 === 0) { // 每10次记录一次
      this.handleMouseMove(event as MouseEvent);
    }
  };

  install(pluginManager: PluginManager, options: any = {}): void {
    this.config = options;
    this.startTracking();
  }

  uninstall(): void {
    this.stopTracking();
  }

  /**
   * 开始热力图跟踪
   */
  private startTracking(): void {
    if (this.isTracking) return;
    
    this.isTracking = true;

    // 跟踪点击
    document.addEventListener('click', this.boundHandleClick, true);
    
    // 跟踪鼠标移动（采样）
    document.addEventListener('mousemove', this.boundHandleMouseMove, true);

    // 跟踪滚动
    window.addEventListener('scroll', this.boundHandleScroll, true);
  }

  /**
   * 停止热力图跟踪
   */
  private stopTracking(): void {
    this.isTracking = false;
    document.removeEventListener('click', this.boundHandleClick, true);
    document.removeEventListener('mousemove', this.boundHandleMouseMove, true);
    window.removeEventListener('scroll', this.boundHandleScroll, true);
  }

  /**
   * 追加热力图数据（保留最近 MAX_HEATMAP_DATA 条）
   */
  private pushData(data: any): void {
    this.heatmapData.push(data);
    if (this.heatmapData.length > HeatmapPlugin.MAX_HEATMAP_DATA) {
      this.heatmapData.splice(0, this.heatmapData.length - HeatmapPlugin.MAX_HEATMAP_DATA);
    }
  }

  /**
   * 处理点击事件
   */
  private handleClick(event: MouseEvent): void {
    const data = {
      type: 'click',
      x: event.clientX,
      y: event.clientY,
      pageX: event.pageX,
      pageY: event.pageY,
      timestamp: Date.now(),
      element: this.getElementInfo(event.target as Element),
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
    };

    this.pushData(data);
    this.sendHeatmapData(data);
  }

  /**
   * 处理鼠标移动事件
   */
  private handleMouseMove(event: MouseEvent): void {
    const data = {
      type: 'move',
      x: event.clientX,
      y: event.clientY,
      pageX: event.pageX,
      pageY: event.pageY,
      timestamp: Date.now(),
    };

    this.pushData(data);
  }

  /**
   * 处理滚动事件
   */
  private handleScroll(): void {
    const data = {
      type: 'scroll',
      scrollX: window.pageXOffset,
      scrollY: window.pageYOffset,
      timestamp: Date.now(),
    };

    this.pushData(data);
  }

  /**
   * 获取元素信息
   */
  private getElementInfo(element: Element): any {
    return {
      tagName: element.tagName,
      id: element.id,
      className: element.className,
      textContent: element.textContent?.substring(0, 50),
    };
  }

  /**
   * 发送热力图数据
   */
  private sendHeatmapData(data: any): void {
    // 触发自定义事件
    window.dispatchEvent(new CustomEvent('probe-x-heatmap', { detail: data }));
  }

  /**
   * 获取热力图数据
   */
  getHeatmapData(): any[] {
    return [...this.heatmapData];
  }

  /**
   * 清空热力图数据
   */
  clearHeatmapData(): void {
    this.heatmapData = [];
  }
}

/**
 * 内置插件：会话重放
 */
export class SessionReplayPlugin implements Plugin {
  name = 'session-replay';
  version = '1.0.0';
  
  private isRecording: boolean = false;
  private replayData: any[] = [];
  private mutationObserver?: MutationObserver;
  private config: any;
  private pluginManager?: PluginManager;
  // replayData 只保留最近 N 条，避免内存无限增长
  private static readonly MAX_REPLAY_DATA = 5000;
  // 保存事件监听 handler 引用，stopRecording 时移除
  private boundRecordEvent = (event: Event) => this.recordEvent(event);
  private domReadyHandler?: () => void;

  install(pluginManager: PluginManager, options: any = {}): void {
    this.config = options;
    this.pluginManager = pluginManager;
    this.startRecording();
  }

  uninstall(): void {
    this.stopRecording();
  }

  /**
   * 开始录制
   */
  private startRecording(): void {
    if (this.isRecording) return;
    
    this.isRecording = true;

    // 记录初始DOM状态
    this.recordDOMSnapshot();

    // 监听DOM变化
    this.mutationObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        this.recordMutation(mutation);
      });
    });

    const startObserving = () => {
      // 插件可能已被卸载，仅在录制中才 observe
      if (!this.isRecording) return;
      this.mutationObserver?.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeOldValue: true,
        characterData: true,
        characterDataOldValue: true,
      });
    };

    // document.body 可能尚未就绪（如在 <head> 中加载 SDK），延迟到 DOMContentLoaded 再 observe
    if (document.body) {
      startObserving();
    } else {
      this.domReadyHandler = startObserving;
      document.addEventListener('DOMContentLoaded', this.domReadyHandler);
    }

    // 监听用户交互
    document.addEventListener('click', this.boundRecordEvent, true);
    document.addEventListener('input', this.boundRecordEvent, true);
    document.addEventListener('scroll', this.boundRecordEvent, true);
  }

  /**
   * 停止录制
   */
  private stopRecording(): void {
    this.isRecording = false;
    
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
    }

    // 移除延迟 observe 的监听（body 未就绪场景）
    if (this.domReadyHandler) {
      document.removeEventListener('DOMContentLoaded', this.domReadyHandler);
      this.domReadyHandler = undefined;
    }

    // 移除用户交互监听
    document.removeEventListener('click', this.boundRecordEvent, true);
    document.removeEventListener('input', this.boundRecordEvent, true);
    document.removeEventListener('scroll', this.boundRecordEvent, true);
  }

  /**
   * 追加重放数据（保留最近 MAX_REPLAY_DATA 条）
   */
  private pushData(data: any): void {
    this.replayData.push(data);
    if (this.replayData.length > SessionReplayPlugin.MAX_REPLAY_DATA) {
      this.replayData.splice(0, this.replayData.length - SessionReplayPlugin.MAX_REPLAY_DATA);
    }
  }

  /**
   * 记录DOM快照
   */
  private recordDOMSnapshot(): void {
    const snapshot = {
      type: 'dom_snapshot',
      timestamp: Date.now(),
      data: {
        html: document.documentElement.outerHTML,
        url: window.location.href,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
        },
      },
    };

    this.pushData(snapshot);
  }

  /**
   * 记录DOM变化
   */
  private recordMutation(mutation: MutationRecord): void {
    const data = {
      type: 'dom_mutation',
      timestamp: Date.now(),
      data: {
        type: mutation.type,
        target: this.getElementPath(mutation.target as Element),
        addedNodes: Array.from(mutation.addedNodes).map(node => this.serializeNode(node)),
        removedNodes: Array.from(mutation.removedNodes).map(node => this.serializeNode(node)),
        attributeName: mutation.attributeName,
        oldValue: mutation.oldValue,
        newValue: mutation.type === 'attributes' ? 
          (mutation.target as Element).getAttribute(mutation.attributeName!) : null,
      },
    };

    this.pushData(data);
  }

  /**
   * 记录事件
   */
  private recordEvent(event: Event): void {
    const data = {
      type: 'user_event',
      timestamp: Date.now(),
      data: {
        eventType: event.type,
        target: this.getElementPath(event.target as Element),
        clientX: (event as MouseEvent).clientX,
        clientY: (event as MouseEvent).clientY,
        value: this.maskInputValue(event.target as HTMLInputElement),
      },
    };

    this.pushData(data);
  }

  /**
   * 脱敏输入框的值：密码框一律打码，其余按 maskSensitiveData 配置脱敏
   */
  private maskInputValue(element: HTMLInputElement): string | undefined {
    const value = element?.value;
    if (value === undefined || value === null) {
      return value;
    }

    // 密码框无论配置如何一律打码
    if (element.type === 'password') {
      return '***';
    }

    const maskSensitiveData = this.pluginManager
      ? this.pluginManager.getConfig('maskSensitiveData', true)
      : true;
    if (!maskSensitiveData) {
      return value;
    }

    const sensitiveNames = ['password', 'pwd', 'token', 'secret', 'credit', 'card', 'ssn', 'phone', 'email', 'tel'];
    const identifier = `${element.name || ''} ${element.id || ''}`.toLowerCase();
    if (sensitiveNames.some(name => identifier.includes(name))) {
      return '***';
    }

    return value;
  }

  /**
   * 获取元素路径
   */
  private getElementPath(element: Element): string {
    const path: string[] = [];
    let current: Element | null = element;

    while (current && current !== document.body) {
      let selector = current.tagName.toLowerCase();
      
      if (current.id) {
        selector += `#${current.id}`;
      } else if (current.className) {
        selector += `.${current.className.split(' ').join('.')}`;
      }
      
      path.unshift(selector);
      current = current.parentElement;
    }

    return path.join(' > ');
  }

  /**
   * 序列化节点
   */
  private serializeNode(node: Node): any {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as Element;
      return {
        nodeType: node.nodeType,
        tagName: element.tagName,
        attributes: Array.from(element.attributes).map(attr => ({
          name: attr.name,
          value: attr.value,
        })),
        textContent: element.textContent,
      };
    } else if (node.nodeType === Node.TEXT_NODE) {
      return {
        nodeType: node.nodeType,
        textContent: node.textContent,
      };
    }
    
    return {
      nodeType: node.nodeType,
    };
  }

  /**
   * 获取重放数据
   */
  getReplayData(): any[] {
    return [...this.replayData];
  }

  /**
   * 清空重放数据
   */
  clearReplayData(): void {
    this.replayData = [];
  }
}
