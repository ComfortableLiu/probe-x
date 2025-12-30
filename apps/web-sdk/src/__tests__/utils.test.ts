/**
 * Utils 工具类测试
 */

import { Utils } from '../utils';

describe('Utils', () => {
  describe('generateUUID', () => {
    test('应该生成有效的UUID', () => {
      const uuid = Utils.generateUUID();
      expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    test('每次生成的UUID应该不同', () => {
      const uuid1 = Utils.generateUUID();
      const uuid2 = Utils.generateUUID();
      expect(uuid1).not.toBe(uuid2);
    });
  });

  describe('debounce', () => {
    jest.useFakeTimers();

    test('应该延迟执行函数', () => {
      const mockFn = jest.fn();
      const debouncedFn = Utils.debounce(mockFn, 100);

      debouncedFn();
      expect(mockFn).not.toHaveBeenCalled();

      jest.advanceTimersByTime(100);
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    test('应该取消之前的调用', () => {
      const mockFn = jest.fn();
      const debouncedFn = Utils.debounce(mockFn, 100);

      debouncedFn();
      debouncedFn();
      debouncedFn();

      jest.advanceTimersByTime(100);
      expect(mockFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('throttle', () => {
    jest.useFakeTimers();

    test('应该限制函数执行频率', () => {
      const mockFn = jest.fn();
      const throttledFn = Utils.throttle(mockFn, 100);

      throttledFn();
      throttledFn();
      throttledFn();

      expect(mockFn).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(100);
      throttledFn();
      expect(mockFn).toHaveBeenCalledTimes(2);
    });
  });

  describe('deepClone', () => {
    test('应该深拷贝对象', () => {
      const original = {
        a: 1,
        b: {
          c: 2,
          d: [3, 4, { e: 5 }],
        },
        f: new Date('2023-01-01'),
      };

      const cloned = Utils.deepClone(original);

      expect(cloned).toEqual(original);
      expect(cloned).not.toBe(original);
      expect(cloned.b).not.toBe(original.b);
      expect(cloned.b.d).not.toBe(original.b.d);
      expect(cloned.f).not.toBe(original.f);
    });

    test('应该处理基本类型', () => {
      expect(Utils.deepClone(null)).toBe(null);
      expect(Utils.deepClone(undefined)).toBe(undefined);
      expect(Utils.deepClone(42)).toBe(42);
      expect(Utils.deepClone('hello')).toBe('hello');
      expect(Utils.deepClone(true)).toBe(true);
    });
  });

  describe('getUrlParameter', () => {
    test('应该获取URL参数', () => {
      const url = 'https://example.com?foo=bar&baz=qux';
      expect(Utils.getUrlParameter('foo', url)).toBe('bar');
      expect(Utils.getUrlParameter('baz', url)).toBe('qux');
      expect(Utils.getUrlParameter('notfound', url)).toBe(null);
    });

    test('应该处理无效URL', () => {
      expect(Utils.getUrlParameter('foo', 'invalid-url')).toBe(null);
    });
  });

  describe('getAllUrlParameters', () => {
    test('应该获取所有URL参数', () => {
      const url = 'https://example.com?foo=bar&baz=qux&empty=';
      const params = Utils.getAllUrlParameters(url);
      
      expect(params).toEqual({
        foo: 'bar',
        baz: 'qux',
        empty: '',
      });
    });

    test('应该处理无参数的URL', () => {
      const url = 'https://example.com';
      const params = Utils.getAllUrlParameters(url);
      expect(params).toEqual({});
    });
  });

  describe('设备检测', () => {
    test('isMobile 应该检测移动设备', () => {
      // 模拟移动设备 User Agent
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
        configurable: true,
      });

      expect(Utils.isMobile()).toBe(true);
    });

    test('isIOS 应该检测iOS设备', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
        configurable: true,
      });

      expect(Utils.isIOS()).toBe(true);
    });

    test('isAndroid 应该检测Android设备', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Linux; Android 10; SM-G975F)',
        configurable: true,
      });

      expect(Utils.isAndroid()).toBe(true);
    });
  });

  describe('formatDate', () => {
    test('应该格式化日期', () => {
      const date = new Date('2023-01-01T12:30:45.123Z');
      
      expect(Utils.formatDate(date, 'YYYY-MM-DD')).toBe('2023-01-01');
      expect(Utils.formatDate(date, 'HH:mm:ss')).toBe('12:30:45');
      expect(Utils.formatDate(date, 'YYYY-MM-DD HH:mm:ss.SSS')).toBe('2023-01-01 12:30:45.123');
    });
  });

  describe('isEmpty', () => {
    test('应该正确检测空值', () => {
      expect(Utils.isEmpty(null)).toBe(true);
      expect(Utils.isEmpty(undefined)).toBe(true);
      expect(Utils.isEmpty('')).toBe(true);
      expect(Utils.isEmpty([])).toBe(true);
      expect(Utils.isEmpty({})).toBe(true);
      
      expect(Utils.isEmpty('hello')).toBe(false);
      expect(Utils.isEmpty([1, 2, 3])).toBe(false);
      expect(Utils.isEmpty({ a: 1 })).toBe(false);
      expect(Utils.isEmpty(0)).toBe(false);
      expect(Utils.isEmpty(false)).toBe(false);
    });
  });

  describe('safeGet', () => {
    test('应该安全获取嵌套属性', () => {
      const obj = {
        a: {
          b: {
            c: 'value',
          },
        },
      };

      expect(Utils.safeGet(obj, 'a.b.c')).toBe('value');
      expect(Utils.safeGet(obj, 'a.b.d', 'default')).toBe('default');
      expect(Utils.safeGet(obj, 'x.y.z')).toBe(undefined);
    });
  });

  describe('randomString', () => {
    test('应该生成指定长度的随机字符串', () => {
      const str = Utils.randomString(10);
      expect(str).toHaveLength(10);
      expect(typeof str).toBe('string');
    });

    test('应该使用自定义字符集', () => {
      const str = Utils.randomString(10, '123');
      expect(str).toHaveLength(10);
      expect(/^[123]+$/.test(str)).toBe(true);
    });
  });

  describe('URL验证', () => {
    test('isValidUrl 应该验证URL', () => {
      expect(Utils.isValidUrl('https://example.com')).toBe(true);
      expect(Utils.isValidUrl('http://localhost:3000')).toBe(true);
      expect(Utils.isValidUrl('ftp://files.example.com')).toBe(true);
      
      expect(Utils.isValidUrl('invalid-url')).toBe(false);
      expect(Utils.isValidUrl('just-text')).toBe(false);
    });

    test('isValidEmail 应该验证邮箱', () => {
      expect(Utils.isValidEmail('test@example.com')).toBe(true);
      expect(Utils.isValidEmail('user.name+tag@domain.co.uk')).toBe(true);
      
      expect(Utils.isValidEmail('invalid-email')).toBe(false);
      expect(Utils.isValidEmail('@example.com')).toBe(false);
      expect(Utils.isValidEmail('test@')).toBe(false);
    });

    test('isValidPhone 应该验证手机号', () => {
      expect(Utils.isValidPhone('13800138000')).toBe(true);
      expect(Utils.isValidPhone('15912345678')).toBe(true);
      
      expect(Utils.isValidPhone('12345678901')).toBe(false);
      expect(Utils.isValidPhone('1380013800')).toBe(false);
      expect(Utils.isValidPhone('invalid')).toBe(false);
    });
  });

  describe('HTML处理', () => {
    test('escapeHtml 应该转义HTML字符', () => {
      expect(Utils.escapeHtml('<script>alert("xss")</script>')).toBe('&lt;script&gt;alert("xss")&lt;/script&gt;');
      expect(Utils.escapeHtml('Hello & World')).toBe('Hello &amp; World');
    });

    test('unescapeHtml 应该反转义HTML字符', () => {
      expect(Utils.unescapeHtml('&lt;div&gt;Hello&lt;/div&gt;')).toBe('<div>Hello</div>');
      expect(Utils.unescapeHtml('Hello &amp; World')).toBe('Hello & World');
    });
  });

  describe('字符串转换', () => {
    test('toCamelCase 应该转换为驼峰命名', () => {
      expect(Utils.toCamelCase('hello-world')).toBe('helloWorld');
      expect(Utils.toCamelCase('hello_world')).toBe('helloWorld');
      expect(Utils.toCamelCase('hello world')).toBe('helloWorld');
    });

    test('toKebabCase 应该转换为短横线命名', () => {
      expect(Utils.toKebabCase('helloWorld')).toBe('hello-world');
      expect(Utils.toKebabCase('HelloWorld')).toBe('hello-world');
    });

    test('toSnakeCase 应该转换为下划线命名', () => {
      expect(Utils.toSnakeCase('helloWorld')).toBe('hello_world');
      expect(Utils.toSnakeCase('HelloWorld')).toBe('hello_world');
    });
  });

  describe('truncate', () => {
    test('应该截断长字符串', () => {
      expect(Utils.truncate('Hello World', 5)).toBe('He...');
      expect(Utils.truncate('Hello World', 5, '---')).toBe('He---');
      expect(Utils.truncate('Hi', 10)).toBe('Hi');
    });
  });

  describe('formatFileSize', () => {
    test('应该格式化文件大小', () => {
      expect(Utils.formatFileSize(0)).toBe('0 Bytes');
      expect(Utils.formatFileSize(1024)).toBe('1 KB');
      expect(Utils.formatFileSize(1024 * 1024)).toBe('1 MB');
      expect(Utils.formatFileSize(1024 * 1024 * 1024)).toBe('1 GB');
    });
  });
});
